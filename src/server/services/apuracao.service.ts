import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { calcularComissao } from "@/domain/comissao/engine";
import type { ComissaoInput, PlanoConfig } from "@/domain/comissao/types";
import {
  upsertApuracao,
  getApuracao as getApuracaoRepo,
  listarApuracoesDoMes as listarApuracoesDoMesRepo,
  fecharMes,
  reabrirMes,
  existeMesFechado,
  definirObservacaoApuracaoRow,
} from "@/server/repositories/comissao-apurada.repo";
import { getPlanoVigente } from "@/server/services/plano-comissao.service";
import { getMeta } from "@/server/services/meta.service";
import { recebidoNoMes } from "@/server/services/recebimento.service";
import { listarRecebimentosDoMes } from "@/server/repositories/recebimento.repo";
import { listarColaboradores, getColaborador } from "@/server/repositories/colaborador.repo";
import { registrarAudit } from "@/server/services/audit.service";
import { contarCallsRealizadas } from "@/server/services/agendamento.service";

// Coração da Fase 5 (COMIS-04/05/06/07): liga o motor puro (05-01) ao banco
// (05-02). Gera/atualiza o snapshot imutável por (colaborador, mês) — os
// painéis (Fases 8/9) LEEM este snapshot e NUNCA recalculam ao vivo
// (Anti-Pattern 1). NÃO faz authz (vive nas Server Actions, via
// requireRole("ADMIN")) — este service só orquestra motor + repos + auditoria.

// mesReferencia + 1 mês, timezone-safe: opera só sobre os componentes
// numéricos da string "YYYY-MM-01" via Date.UTC (só para o overflow de
// dezembro -> janeiro), lendo de volta com getUTC* — nunca `new
// Date(string)` (Pitfall 2/Pitfall 6, mesmo padrão de `diaAnterior` em
// plano-comissao.service.ts).
export function mesSeguinte(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, 1));
  data.setUTCMonth(data.getUTCMonth() + 1);

  const anoSeguinte = data.getUTCFullYear();
  const mesSeguinteStr = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${anoSeguinte}-${mesSeguinteStr}-01`;
}

// Base "recebido no mês" por PAPEL (v1.4/JP-01), consumida pelos 3 formatos
// recebido-based (percentual_fixo, progressivo_atingimento, fixo_variavel) e
// gravada como valorBase de auditoria nos 2 formatos fixos
// (salario_bonus_atingimento, por_calls — que NÃO usam este valor no cálculo
// do payout, só exibem):
//   - CLOSER: recebido das vendas em que ele é o closer (closerId) — mesma
//     fonte de sempre.
//   - SDR/SS: recebido das vendas em que ele é o SDR de ORIGEM (sdrId) —
//     ex.: João Pedro, cuja comissão v1.4 é um % sobre o recebido das
//     vendas que ele originou como SDR.
// ANTES da v1.4 o código fazia `porCloser[id] ?? porSdr[id] ?? 0`, que só
// funcionava "por acaso" (um colaborador nunca aparecia nos dois mapas ao
// mesmo tempo) — explicitar pelo papel remove essa suposição implícita.
// Papel desconhecido/colaborador não encontrado cai no comportamento
// histórico (porCloser), preservando qualquer chamador que ainda não tenha
// um Colaborador resolvível.
function valorRecebidoPorPapel(
  papel: string | null | undefined,
  colaboradorId: string,
  recebido: { porCloser: Record<string, number>; porSdr: Record<string, number> },
): number {
  if (papel === "SDR" || papel === "SS") {
    return recebido.porSdr[colaboradorId] ?? 0;
  }
  return recebido.porCloser[colaboradorId] ?? 0;
}

export type ApurarComissaoOpts = {
  calculadoPor?: string | null;
  percentualAtingimento?: number;
  numeroCallsRealizadas?: number;
  /** Uso interno de reabrirApuracao — permite reapurar um mês tecnicamente
   * ainda marcado como FECHADA no instante da chamada (a reabertura já
   * reabriu a linha antes de decidir se reapura). */
  permitirFechado?: boolean;
};

// Apura a comissão de UM colaborador em UMA competência: busca o plano
// vigente + o recebido no mês (papel-aware: closer usa porCloser, SDR/SS usa
// porSdr), chama o motor puro (NUNCA cálculo inline) e grava o snapshot.
export async function apurarComissao(
  colaboradorId: string,
  mesReferencia: string,
  opts: ApurarComissaoOpts = {},
) {
  if (!opts.permitirFechado && (await existeMesFechado(mesReferencia))) {
    throw new Error("Mês fechado: reabra a apuração antes de recalcular");
  }

  const plano = await getPlanoVigente(colaboradorId);
  if (!plano) {
    // Sem plano vigente: pular é mais robusto para apurarMes (um colaborador
    // sem plano definido não deveria travar a apuração de todos os outros).
    // Chamadores que precisam de erro explícito para 1 pessoa devem checar
    // getPlanoVigente antes de chamar apurarComissao.
    return null;
  }

  const colaborador = await getColaborador(colaboradorId);

  const recebido = await recebidoNoMes(mesReferencia);
  const valorRecebidoNoMes = valorRecebidoPorPapel(
    colaborador?.papel,
    colaboradorId,
    recebido,
  );
  const baseRecebidoDetalhe = {
    papel: colaborador?.papel ?? null,
    origem:
      colaborador?.papel === "SDR" || colaborador?.papel === "SS"
        ? ("sdrId" as const)
        : ("closerId" as const),
  };

  const planoConfig = { tipo: plano.tipo, config: plano.config } as PlanoConfig;

  // Fase 7 (AGEND-02): numeroCallsRealizadas vem da MESMA fonte única usada
  // pelo painel de meta (contarCallsRealizadas, agendamento.service.ts) —
  // só busca no banco quando o plano é por_calls, evitando uma query extra
  // desnecessária para os outros 3 formatos. opts.numeroCallsRealizadas
  // continua aceito como override explícito (ex.: reapuração de meses
  // históricos/Fase 10, ou testes), mas o caminho padrão agora é real.
  const numeroCallsRealizadas =
    opts.numeroCallsRealizadas ??
    (plano.tipo === "por_calls"
      ? await contarCallsRealizadas(colaboradorId, mesReferencia)
      : 0);

  // Fase v1.2/v1.3: percentualAtingimento (fração, 1 = 100%) agora é REAL —
  // busca a meta do colaborador na competência e divide o realizado pela
  // meta, BRANCHING pela unidade da meta (nunca assume VALOR):
  //   - unidade VALOR (closer): recebidoNoMes(colaborador) / valorMeta.
  //   - unidade AGENDAMENTOS (SDR/SS): contarCallsRealizadas(colaborador,
  //     mês) / metaAgendamentos — a MESMA fonte única de reuniões
  //     REALIZADAS usada pelo painel de meta (Fase 6/7, AGEND-02). Antes da
  //     v1.3 este branch não existia: SDR/SS sempre caíam no `else` de
  //     unidade!=="VALOR" => metaValor=0 => atingimento sempre 0,
  //     zerando bônus de qualquer plano por atingimento configurado para
  //     SDR/SS. Sem meta definida (ou meta=0): atingimento 0, nunca divide
  //     por zero. opts.percentualAtingimento continua aceito como override
  //     explícito (ex.: reapuração histórica, testes).
  let percentualAtingimento = opts.percentualAtingimento;
  let atingimentoDetalhe: {
    unidade: "VALOR" | "AGENDAMENTOS";
    numerador: number;
    denominador: number;
  } | null = null;
  if (percentualAtingimento === undefined) {
    const precisaAtingimento =
      plano.tipo === "progressivo_atingimento" ||
      plano.tipo === "salario_bonus_atingimento";
    if (precisaAtingimento) {
      const meta = await getMeta(colaboradorId, mesReferencia);
      if (meta?.unidade === "VALOR") {
        const metaValor = meta.valorMeta ?? 0;
        percentualAtingimento = metaValor > 0 ? valorRecebidoNoMes / metaValor : 0;
        atingimentoDetalhe = {
          unidade: "VALOR",
          numerador: valorRecebidoNoMes,
          denominador: metaValor,
        };
      } else if (meta?.unidade === "AGENDAMENTOS") {
        const metaReunioes = meta.metaAgendamentos ?? 0;
        const reunioesRealizadas = await contarCallsRealizadas(
          colaboradorId,
          mesReferencia,
        );
        percentualAtingimento =
          metaReunioes > 0 ? reunioesRealizadas / metaReunioes : 0;
        atingimentoDetalhe = {
          unidade: "AGENDAMENTOS",
          numerador: reunioesRealizadas,
          denominador: metaReunioes,
        };
      } else {
        percentualAtingimento = 0;
      }
    } else {
      percentualAtingimento = 0;
    }
  }

  const input: ComissaoInput = {
    colaboradorId,
    mesReferencia,
    plano: planoConfig,
    valorRecebidoNoMes,
    percentualAtingimento,
    numeroCallsRealizadas,
  };

  const resultado = calcularComissao(input);

  const apuracao = await upsertApuracao(db, {
    colaboradorId,
    mesReferencia,
    mesPagamento: mesSeguinte(mesReferencia),
    planoComissaoId: plano.id,
    tipoPlano: plano.tipo,
    valorBase: resultado.valorBase,
    percentualAplicado: resultado.percentualAplicado,
    valorComissao: resultado.valorComissao,
    // ComissaoInput é uma interface (sem index signature), então precisa de
    // um cast explícito para o tipo JSONB do Prisma — o shape em si já é
    // JSON-serializável (só primitivos/objeto plano), sem perda de dados.
    // `detalhamento` (breakdown do motor — ex.: salarioFixo/bonus/total do
    // Closer Jr, faixaEscolhida do progressivo) é anexado ao lado dos campos
    // de ComissaoInput, para o extrato/UI exibir sem precisar de colunas
    // novas em ComissaoApurada (COMIS-05: snapshot único de auditoria).
    // `atingimento` (v1.3): numerador/denominador/unidade que originaram
    // percentualAtingimento — só presente quando o plano precisa de
    // atingimento E há meta definida; permite ao extrato mostrar "30/45
    // reuniões" (SDR/SS) ou "R$ recebido/meta" (closer) em vez de só a
    // fração final.
    // `baseRecebido` (v1.4): qual mapa (closerId/sdrId) originou
    // valorRecebidoNoMes/valorBase — permite ao extrato mostrar "recebido
    // como SDR" vs "recebido como closer" em vez de só o número final.
    inputSnapshot: {
      ...input,
      detalhamento: {
        ...resultado.detalhamento,
        baseRecebido: baseRecebidoDetalhe,
        ...(atingimentoDetalhe ? { atingimento: atingimentoDetalhe } : {}),
      },
    } as unknown as Prisma.InputJsonValue,
    calculadoPor: opts.calculadoPor ?? null,
  });

  await registrarAudit({
    acao: "APURAR_COMISSAO",
    entidade: "comissao_apurada",
    entidadeId: apuracao.id,
    colaboradorId,
    usuarioId: opts.calculadoPor ?? null,
    dadosDepois: {
      mesReferencia,
      valorComissao: resultado.valorComissao,
      percentualAplicado: resultado.percentualAplicado,
    },
  });

  return apuracao;
}

// Apura TODOS os colaboradores ativos que têm plano vigente na competência.
// Colaboradores sem plano vigente são pulados silenciosamente (ver nota em
// apurarComissao). Retorna um resumo simples (nº apurados/pulados).
export async function apurarMes(
  mesReferencia: string,
  opts: ApurarComissaoOpts = {},
) {
  if (!opts.permitirFechado && (await existeMesFechado(mesReferencia))) {
    throw new Error("Mês fechado: reabra a apuração antes de recalcular");
  }

  const colaboradores = await listarColaboradores();
  const ativos = colaboradores.filter((c) => c.ativo);

  let apurados = 0;
  let pulados = 0;

  for (const colaborador of ativos) {
    const apuracao = await apurarComissao(colaborador.id, mesReferencia, {
      ...opts,
      // Já validamos o mês fechado acima; evita checar de novo por pessoa.
      permitirFechado: true,
    });
    if (apuracao) {
      apurados += 1;
    } else {
      pulados += 1;
    }
  }

  return { apurados, pulados, total: ativos.length };
}

// Fecha o mês inteiro (COMIS-06): trava as linhas de comissao_apurada
// (status FECHADA) e marca venda.fechado=true em todas as vendas da
// competência — substituindo o placeholder da Fase 3/4 por uma trava real
// ligada à apuração. Tudo na mesma transação.
export async function fecharApuracao(
  mesReferencia: string,
  fechadoPor?: string | null,
) {
  const resultado = await db.$transaction(async (tx) => {
    await fecharMes(tx, mesReferencia, fechadoPor);

    const vendasDoMes = await tx.venda.findMany({
      where: { mesReferencia: mesReferenciaParaDataUTC(mesReferencia) },
      select: { id: true },
    });
    await tx.venda.updateMany({
      where: { mesReferencia: mesReferenciaParaDataUTC(mesReferencia) },
      data: { fechado: true },
    });

    await registrarAudit({
      tx,
      acao: "FECHAR_APURACAO",
      entidade: "comissao_apurada",
      entidadeId: mesReferencia,
      usuarioId: fechadoPor ?? null,
      dadosDepois: { mesReferencia, vendasTravadas: vendasDoMes.length },
    });

    return { vendasTravadas: vendasDoMes.length };
  });

  return resultado;
}

// Reabre o mês (destrava): volta as linhas para ABERTA e libera as vendas da
// competência para edição novamente. Ação explícita, sempre registrada em
// AuditLog.
export async function reabrirApuracao(
  mesReferencia: string,
  reabertoPor?: string | null,
) {
  const resultado = await db.$transaction(async (tx) => {
    await reabrirMes(tx, mesReferencia);

    await tx.venda.updateMany({
      where: { mesReferencia: mesReferenciaParaDataUTC(mesReferencia) },
      data: { fechado: false },
    });

    await registrarAudit({
      tx,
      acao: "REABRIR_APURACAO",
      entidade: "comissao_apurada",
      entidadeId: mesReferencia,
      usuarioId: reabertoPor ?? null,
      dadosDepois: { mesReferencia },
    });

    return { ok: true };
  });

  return resultado;
}

function mesReferenciaParaDataUTC(mesReferencia: string): Date {
  const [ano, mes, dia] = mesReferencia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

// Observação livre por pessoa/mês (v1.1) — editável mesmo com o mês
// FECHADO (é uma anotação humana, não um valor calculado; COMIS-06 protege
// valorComissao/valorBase/percentualAplicado, não este campo). Grava em
// AuditLog para rastreabilidade (quem anotou o quê).
export async function definirObservacaoApuracao(
  colaboradorId: string,
  mesReferencia: string,
  observacao: string | null,
  definidoPor?: string | null,
) {
  const apuracao = await definirObservacaoApuracaoRow(
    colaboradorId,
    mesReferencia,
    observacao,
  );

  await registrarAudit({
    acao: "APURAR_COMISSAO",
    entidade: "comissao_apurada",
    entidadeId: apuracao.id,
    colaboradorId,
    usuarioId: definidoPor ?? null,
    dadosDepois: { mesReferencia, observacao },
  });

  return apuracao;
}

// Reexports finos p/ a UI ler o snapshot (COMIS-05) — nunca recalcula.
export function getApuracao(colaboradorId: string, mesReferencia: string) {
  return getApuracaoRepo(colaboradorId, mesReferencia);
}

export function listarApuracoesDoMes(mesReferencia: string) {
  return listarApuracoesDoMesRepo(mesReferencia);
}

export type ExtratoLinha = {
  parcelaId: string;
  vendaId: string;
  alunoNome: string;
  tipo: string;
  mesReferencia: string;
  valorRecebido: number;
  dataPagamento: Date | null;
};

// Extrato linha a linha (COMIS-07): o snapshot já apurado + as parcelas
// PAGAS da competência que compuseram o valorBase, para exibir COMO ele foi
// formado.
//
// CORREÇÃO 2026-08-02 — o extrato precisa usar EXATAMENTE o mesmo critério da
// base. Antes, ele filtrava `closerId === id || sdrId === id` (os dois lados),
// enquanto `valorRecebidoPorPapel` usa só UM dos mapas conforme o papel:
// CLOSER soma o que recebeu como closer, SDR/SS o que originou como SDR.
//
// Para quem aparece nos dois papéis — e há pessoas assim no banco: um mesmo
// colaborador é closer em algumas vendas e SDR em outras — o extrato listava
// linhas que NÃO entraram no valorBase, e a soma exibida não fechava com o
// valor apurado. É uma violação direta de COMIS-07 ("o extrato mostra como o
// valor foi calculado"), e o tipo de divergência que destrói a confiança de
// quem confere o próprio pagamento.
//
// A fonte da decisão é a MESMA de apurarComissao (o papel real do
// colaborador), nunca uma segunda regra paralela.
export async function getExtrato(colaboradorId: string, mesReferencia: string) {
  const [apuracao, linhasDoMes, colaborador] = await Promise.all([
    getApuracaoRepo(colaboradorId, mesReferencia),
    listarRecebimentosDoMes(mesReferencia),
    getColaborador(colaboradorId),
  ]);

  const ehSdr = colaborador?.papel === "SDR" || colaborador?.papel === "SS";

  const linhas: ExtratoLinha[] = linhasDoMes
    .filter((p) =>
      ehSdr
        ? p.venda.sdrId === colaboradorId
        : p.venda.closerId === colaboradorId,
    )
    .map((p) => ({
      parcelaId: p.id,
      vendaId: p.vendaId,
      alunoNome: p.venda.alunoNome,
      tipo: p.tipo,
      mesReferencia,
      valorRecebido: p.valorRecebido !== null ? Number(p.valorRecebido) : 0,
      dataPagamento: p.dataPagamento,
    }));

  return { apuracao, linhas };
}
