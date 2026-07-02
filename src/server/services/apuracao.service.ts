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
} from "@/server/repositories/comissao-apurada.repo";
import { getPlanoVigente } from "@/server/services/plano-comissao.service";
import { recebidoNoMes } from "@/server/services/recebimento.service";
import { listarRecebimentosDoMes } from "@/server/repositories/recebimento.repo";
import { listarColaboradores } from "@/server/repositories/colaborador.repo";
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

  const recebido = await recebidoNoMes(mesReferencia);
  const valorRecebidoNoMes =
    recebido.porCloser[colaboradorId] ?? recebido.porSdr[colaboradorId] ?? 0;

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

  const input: ComissaoInput = {
    colaboradorId,
    mesReferencia,
    plano: planoConfig,
    valorRecebidoNoMes,
    // Ponto de integração pluggable com Fase 6 (Metas), ainda não existente
    // — default 0 documentado em types.ts/engine.ts (05-01).
    percentualAtingimento: opts.percentualAtingimento ?? 0,
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
    inputSnapshot: input as unknown as Prisma.InputJsonValue,
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
// PAGAS da competência que pertencem a este colaborador (como closer OU
// sdr), para exibir COMO o valorBase foi composto.
export async function getExtrato(colaboradorId: string, mesReferencia: string) {
  const apuracao = await getApuracaoRepo(colaboradorId, mesReferencia);

  const linhasDoMes = await listarRecebimentosDoMes(mesReferencia);
  const linhas: ExtratoLinha[] = linhasDoMes
    .filter(
      (p) => p.venda.closerId === colaboradorId || p.venda.sdrId === colaboradorId,
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
