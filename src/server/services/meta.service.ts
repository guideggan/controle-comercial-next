import "server-only";

import type { MetaUnidade } from "@prisma/client";

import {
  upsertMetaRow,
  getMetaRow,
  listarMetasDoMes,
  dataParaString,
} from "@/server/repositories/meta.repo";
import { getColaborador } from "@/server/repositories/colaborador.repo";
import {
  definirMetaSchema,
  type DefinirMetaInput,
} from "@/server/actions/metas.schemas";
import { proracaoSemanal, type SemanaProrateada } from "@/domain/metas/proracao";
import { recebidoNoMes } from "@/server/services/recebimento.service";
import { contarCallsRealizadas } from "@/server/services/agendamento.service";
import type { ResultadoRecebidoNoMes } from "@/domain/recebimentos/agregacao";
import type { AgendamentoLinha } from "@/domain/agendamentos/agregacao";
import { contarCallsRealizadas as contarCallsRealizadasPuro } from "@/domain/agendamentos/agregacao";

// Fachada pública da Fase 6 (META-01/02/03/04), consumida pelas Server
// Actions (metas.actions.ts) e, a partir da Fase 8, pelo painel do
// colaborador — mesmo padrão de recebimento.service.ts/agendamento.service.ts.
// NÃO faz authz aqui (fica nas actions/pages); este service só valida,
// resolve a unidade pelo papel, e orquestra proração pura + realizado das
// fontes ÚNICAS já existentes (recebidoNoMes, contarCallsRealizadas — nunca
// reimplementa essas somas, META-04).

// Detecta a unidade da meta a partir do papel do colaborador (META-01):
// CLOSER comissiona em R$ recebido -> meta em VALOR; SDR/SS comissiona por
// calls -> meta em AGENDAMENTOS. ADMIN não tem meta (papel de gestão).
//
// Nomenclatura (v1.1): o enum MetaUnidade.AGENDAMENTOS é mantido estável
// (é o nome da coluna/valor persistido, trocar quebraria dados existentes),
// mas o SIGNIFICADO de negócio — e todo texto voltado ao usuário — é
// "reuniões REALIZADAS", nunca "agendadas". Isso já é garantido pelo
// cálculo: `realizadoMes` para SDR/SS sempre vem de
// contarCallsRealizadas/contarCallsRealizadasPuro (src/domain/agendamentos/
// agregacao.ts), que soma exclusivamente status=REALIZADO — nunca AGENDADO.
// A camada de UI (fora do escopo deste service) deve rotular esta unidade
// como "reuniões realizadas", não "agendamentos".
function unidadeParaPapel(papel: string): MetaUnidade {
  if (papel === "CLOSER") return "VALOR";
  if (papel === "SDR" || papel === "SS") return "AGENDAMENTOS";
  throw new Error(
    `Papel "${papel}" não possui unidade de meta definida (apenas CLOSER/SDR/SS)`,
  );
}

// Define (ou redefine) a meta mensal de um colaborador (META-01). A unidade
// é sempre derivada do papel — nunca aceita do client — e o campo
// correspondente (valorMeta ou metaAgendamentos) precisa estar presente,
// senão o CHECK do banco rejeitaria a escrita com um erro pouco claro.
export async function definirMeta(colaboradorId: string, input: DefinirMetaInput) {
  const parsed = definirMetaSchema.parse(input);

  const colaborador = await getColaborador(colaboradorId);
  if (!colaborador) {
    throw new Error("Colaborador não encontrado");
  }

  const unidade = unidadeParaPapel(colaborador.papel);

  if (unidade === "VALOR" && parsed.valorMeta === undefined) {
    throw new Error("valorMeta é obrigatório para colaboradores CLOSER");
  }
  if (unidade === "AGENDAMENTOS" && parsed.metaAgendamentos === undefined) {
    throw new Error(
      "metaAgendamentos é obrigatório para colaboradores SDR/SS",
    );
  }

  return upsertMetaRow({
    colaboradorId,
    mesReferencia: parsed.mesReferencia,
    unidade,
    valorMeta: unidade === "VALOR" ? parsed.valorMeta : null,
    metaAgendamentos:
      unidade === "AGENDAMENTOS" ? parsed.metaAgendamentos : null,
  });
}

export type MetaDoColaborador = {
  colaboradorId: string;
  mesReferencia: string;
  unidade: MetaUnidade;
  valorMeta: number | null;
  metaAgendamentos: number | null;
} | null;

export async function getMeta(
  colaboradorId: string,
  mesReferencia: string,
): Promise<MetaDoColaborador> {
  const meta = await getMetaRow(colaboradorId, mesReferencia);
  if (!meta) return null;

  return {
    colaboradorId: meta.colaboradorId,
    mesReferencia: dataParaString(meta.mesReferencia),
    unidade: meta.unidade,
    valorMeta: meta.valorMeta !== null ? Number(meta.valorMeta) : null,
    metaAgendamentos: meta.metaAgendamentos,
  };
}

export async function listarMetasMes(mesReferencia: string) {
  const linhas = await listarMetasDoMes(mesReferencia);
  return linhas.map((meta) => ({
    colaboradorId: meta.colaboradorId,
    mesReferencia: dataParaString(meta.mesReferencia),
    unidade: meta.unidade,
    valorMeta: meta.valorMeta !== null ? Number(meta.valorMeta) : null,
    metaAgendamentos: meta.metaAgendamentos,
  }));
}

export type AcompanhamentoSemana = SemanaProrateada & {
  realizadoAcumulado: number;
  percentualAtingido: number; // fração 0..1 — realizadoAcumulado / metaProporcionalAcumulada (0 quando meta=0)
  saldo: number; // metaProporcionalAcumulada - realizadoAcumulado (pode ser negativo = superou)
};

export type AcompanhamentoMeta = {
  colaboradorId: string;
  mesReferencia: string;
  unidade: MetaUnidade | null; // null quando não há meta definida no mês
  metaMensal: number; // 0 quando não há meta definida
  realizadoMes: number; // realizado TOTAL do mês (até hoje), fonte única (META-04)
  semanas: AcompanhamentoSemana[];
};

// Função reutilizável (META-03), que também alimenta o painel do
// colaborador da Fase 8 — getAcompanhamentoMeta(colaboradorId, mesReferencia)
// junta: meta mensal (se definida) + proração semanal pura + realizado das
// fontes ÚNICAS já existentes (recebidoNoMes para closer, contarCallsRealizadas
// para SDR/SS — nunca uma soma reimplementada aqui, META-04).
//
// "Realizado acumulado" por semana é aproximado como o realizado TOTAL do
// mês até a data de hoje, distribuído nas semanas já concluídas/em
// andamento (o realizado real não tem granularidade semanal persistida
// separadamente — as fontes únicas somam por MÊS). Para a semana corrente e
// anteriores, mostramos o mesmo realizado-do-mês-até-agora como
// "acumulado", que é a leitura correta de "quanto já bati contra a meta
// proporcional desta semana": o realizado do mês inteiro até hoje É o
// acumulado correto de comparar contra a meta proporcional acumulada de
// qualquer semana já iniciada.
// Contexto opcional com os agregados do mês JÁ BUSCADOS pelo caller (batch),
// para evitar que getAcompanhamentoMeta refaça QUALQUER query POR
// COLABORADOR — era o N+1 do dashboard consolidado (GESTOR-04, até 20
// colaboradores hoje = até 20x as mesmas 4 queries repetidas: colaborador,
// meta, recebidoNoMes do mês inteiro, agendamentos do mês inteiro). Quando
// omitido, o comportamento é IDÊNTICO ao original (busca sob demanda) —
// usado pelos callers de um único colaborador (/painel, /metas), que não
// pagam esse custo e continuam com a mesma assinatura de antes.
export type ContextoAcompanhamentoMeta = {
  colaborador: { papel: string };
  meta: MetaDoColaborador;
  recebidoNoMes: ResultadoRecebidoNoMes;
  agendamentosDoMes: AgendamentoLinha[];
};

export async function getAcompanhamentoMeta(
  colaboradorId: string,
  mesReferencia: string,
  contexto?: ContextoAcompanhamentoMeta,
): Promise<AcompanhamentoMeta> {
  const [colaborador, meta] = contexto
    ? [contexto.colaborador, contexto.meta]
    : await Promise.all([
        getColaborador(colaboradorId),
        getMeta(colaboradorId, mesReferencia),
      ]);
  if (!colaborador) {
    throw new Error("Colaborador não encontrado");
  }

  const metaMensal =
    meta?.unidade === "VALOR"
      ? (meta.valorMeta ?? 0)
      : meta?.unidade === "AGENDAMENTOS"
        ? (meta.metaAgendamentos ?? 0)
        : 0;

  // Realizado (META-04): fonte única por papel, nunca reimplementada aqui.
  // Quando `contexto` é fornecido (batch), reagrupa os dados já buscados em
  // vez de rebuscar — a mesma fonte única, só sem repetir a query/agregação.
  let realizadoMes = 0;
  if (colaborador.papel === "CLOSER") {
    const recebido = contexto
      ? contexto.recebidoNoMes
      : await recebidoNoMes(mesReferencia);
    realizadoMes = recebido.porCloser[colaboradorId] ?? 0;
  } else if (colaborador.papel === "SDR" || colaborador.papel === "SS") {
    realizadoMes = contexto
      ? contarCallsRealizadasPuro(contexto.agendamentosDoMes, colaboradorId, mesReferencia)
      : await contarCallsRealizadas(colaboradorId, mesReferencia);
  }

  const semanasBase =
    metaMensal > 0 ? proracaoSemanal(metaMensal, mesReferencia) : [];

  const semanas: AcompanhamentoSemana[] = semanasBase.map((semana) => {
    const percentualAtingido =
      semana.metaProporcionalAcumulada > 0
        ? realizadoMes / semana.metaProporcionalAcumulada
        : 0;
    const saldo = semana.metaProporcionalAcumulada - realizadoMes;

    return {
      ...semana,
      realizadoAcumulado: realizadoMes,
      percentualAtingido,
      saldo,
    };
  });

  return {
    colaboradorId,
    mesReferencia,
    unidade: meta?.unidade ?? null,
    metaMensal,
    realizadoMes,
    semanas,
  };
}
