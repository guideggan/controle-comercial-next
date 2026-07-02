import "server-only";

import { listarRecebimentosDoMes } from "@/server/repositories/recebimento.repo";
import { recebidoNoMes } from "@/server/services/recebimento.service";
import { listarVendas } from "@/server/repositories/venda.repo";
import { listarApuracoesDoMes } from "@/server/services/apuracao.service";
import { listarColaboradores } from "@/server/repositories/colaborador.repo";
import { listarAgendamentosDoMes, dataParaString } from "@/server/repositories/agendamento.repo";
import {
  getAcompanhamentoMeta,
  listarMetasMes,
  type ContextoAcompanhamentoMeta,
} from "@/server/services/meta.service";
import type { AgendamentoLinha } from "@/domain/agendamentos/agregacao";
import {
  agregarReceitaPorTipo,
  contarVendasPorProduto,
  agregarComissaoPorColaborador,
  type ParcelaReceita,
  type VendaParaContagem,
  type ApuracaoParaRollup,
} from "@/domain/dashboard/agregacao";

// Fachada de leitura do Dashboard do Gestor (Fase 9 — GESTOR-01/02/03/04):
// orquestra as fontes ÚNICAS já existentes (recebidoNoMes, listarVendas,
// listarApuracoesDoMes — snapshot, getAcompanhamentoMeta) e delega toda soma
// para o módulo puro de agregação (src/domain/dashboard/agregacao.ts).
// NUNCA recalcula comissão (Anti-Pattern 1) — lê sempre o snapshot já
// apurado. NÃO faz authz aqui (fica na página, via requireRole("ADMIN")).

function mesReferenciaParaString(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}-01`;
}

// GESTOR-01: receita do mês consolidada (à vista / mensalista / total).
// Reusa listarRecebimentosDoMes (já filtrado por PAGO + competência, mesma
// fonte de recebidoNoMes) e delega o split para o domínio puro.
export async function getReceitaConsolidada(mesReferencia: string) {
  const linhas = await listarRecebimentosDoMes(mesReferencia);

  const parcelas: ParcelaReceita[] = linhas.map((p) => ({
    parcelaId: p.id,
    tipo: p.tipo,
    valorRecebido: p.valorRecebido !== null ? Number(p.valorRecebido) : 0,
  }));

  return agregarReceitaPorTipo(parcelas);
}

// GESTOR-02: contagem de vendas por produto/tier no mês — usa listarVendas
// filtrado pela competência (mesReferencia da VENDA, não da parcela).
// Gate de aprovação (v1.1): só APROVADA conta no dashboard — uma venda
// PENDENTE_APROVACAO/REJEITADA de um closer não infla a contagem até o
// ADMIN decidir.
export async function getContagemPorProduto(mesReferencia: string) {
  const vendas = await listarVendas({ mesReferencia, statusAprovacao: "APROVADA" });

  const paraContagem: VendaParaContagem[] = vendas.map((v) => ({
    vendaId: v.id,
    produtoNome: v.produto.nome,
  }));

  return contarVendasPorProduto(paraContagem);
}

// GESTOR-03: comissão total por colaborador (closer x SDR/SS), lida do
// snapshot JÁ APURADO (listarApuracoesDoMes) — nunca recalcula.
export async function getComissaoPorColaborador(mesReferencia: string) {
  const linhas = await listarApuracoesDoMes(mesReferencia);

  const paraRollup: ApuracaoParaRollup[] = linhas.map((l) => ({
    colaboradorId: l.colaboradorId,
    colaboradorNome: l.colaborador.nome,
    papel: l.colaborador.papel,
    valorComissao: Number(l.valorComissao),
    mesReferencia: mesReferenciaParaString(l.mesReferencia),
    mesPagamento: mesReferenciaParaString(l.mesPagamento),
  }));

  return agregarComissaoPorColaborador(paraRollup);
}

export type AtingimentoMetaLinha = {
  colaboradorId: string;
  colaboradorNome: string;
  papel: string;
  unidade: string | null;
  metaMensal: number;
  realizadoMes: number;
  percentualAtingido: number; // fração 0..1, calculada aqui a partir de metaMensal/realizadoMes (mesma regra de meta.service, sem meta = 0)
};

// GESTOR-04: atingimento de meta de TODOS os colaboradores ativos
// (CLOSER/SDR/SS) em uma única tela — chama getAcompanhamentoMeta (fonte
// única, Fase 6) para cada um, nunca reimplementa a proporção.
//
// PERFORMANCE (N+1 corrigido): getAcompanhamentoMeta internamente busca
// colaborador + meta + recebidoNoMes/contarCallsRealizadas — as duas
// últimas fazem uma query do MÊS INTEIRO (todos os colaboradores) mesmo
// quando só 1 pessoa é consultada. Chamar isso uma vez POR colaborador (até
// 20 no time hoje) repetia as MESMAS 4 queries até 20x. Aqui buscamos tudo
// UMA ÚNICA VEZ (em paralelo) e montamos um `contexto` por colaborador só
// com dados já em memória — zero queries adicionais por colaborador.
export async function getAtingimentoMetaTodos(
  mesReferencia: string,
): Promise<AtingimentoMetaLinha[]> {
  const [colaboradores, metasDoMes, recebido, agendamentosDoMesRaw] =
    await Promise.all([
      listarColaboradores(),
      listarMetasMes(mesReferencia),
      recebidoNoMes(mesReferencia),
      listarAgendamentosDoMes(mesReferencia),
    ]);
  const elegiveis = colaboradores.filter(
    (c) => c.ativo && (c.papel === "CLOSER" || c.papel === "SDR" || c.papel === "SS"),
  );

  const agendamentosDoMes: AgendamentoLinha[] = agendamentosDoMesRaw.map((a) => ({
    id: a.id,
    colaboradorId: a.colaboradorId,
    data: dataParaString(a.data),
    status: a.status,
  }));

  const metaPorColaborador = new Map(metasDoMes.map((m) => [m.colaboradorId, m]));

  const linhas = await Promise.all(
    elegiveis.map(async (colaborador) => {
      const contexto: ContextoAcompanhamentoMeta = {
        colaborador: { papel: colaborador.papel },
        meta: metaPorColaborador.get(colaborador.id) ?? null,
        recebidoNoMes: recebido,
        agendamentosDoMes,
      };

      const acompanhamento = await getAcompanhamentoMeta(
        colaborador.id,
        mesReferencia,
        contexto,
      );

      const percentualAtingido =
        acompanhamento.metaMensal > 0
          ? acompanhamento.realizadoMes / acompanhamento.metaMensal
          : 0;

      return {
        colaboradorId: colaborador.id,
        colaboradorNome: colaborador.nome,
        papel: colaborador.papel,
        unidade: acompanhamento.unidade,
        metaMensal: acompanhamento.metaMensal,
        realizadoMes: acompanhamento.realizadoMes,
        percentualAtingido,
      };
    }),
  );

  return linhas;
}

function mesAnterior(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, 1));
  data.setUTCMonth(data.getUTCMonth() - 1);
  return mesReferenciaParaString(data);
}

export type ReceitaMensalPonto = {
  mes: string; // "YYYY-MM-01"
  total: number;
};

// Série dos últimos N meses (default 6) de receita total, terminando no mês
// selecionado — alimenta o gráfico de linha/área do dashboard. Reusa
// recebidoNoMes mês a mês (mesma fonte de GESTOR-01), sem cache/otimização
// prematura (volumes pequenos nesta fase do produto).
export async function getReceitaUltimosMeses(
  mesReferencia: string,
  quantidade = 6,
) {
  const meses: string[] = [];
  let cursor = mesReferencia;
  for (let i = 0; i < quantidade; i++) {
    meses.unshift(cursor);
    cursor = mesAnterior(cursor);
  }

  const pontos: ReceitaMensalPonto[] = await Promise.all(
    meses.map(async (mes) => {
      const recebido = await recebidoNoMes(mes);
      return { mes, total: recebido.total };
    }),
  );

  return pontos;
}

// Agrega tudo que o dashboard consolidado precisa em uma única chamada, para
// a página fazer um único await em vez de orquestrar 5 promessas soltas.
export async function getDashboardConsolidado(mesReferencia: string) {
  const [receita, contagemProduto, comissao, atingimentoMeta, serieReceita, vendas] =
    await Promise.all([
      getReceitaConsolidada(mesReferencia),
      getContagemPorProduto(mesReferencia),
      getComissaoPorColaborador(mesReferencia),
      getAtingimentoMetaTodos(mesReferencia),
      getReceitaUltimosMeses(mesReferencia),
      listarVendas({ mesReferencia, statusAprovacao: "APROVADA" }),
    ]);

  return {
    mesReferencia,
    receita,
    numeroVendas: vendas.length,
    contagemProduto,
    comissao,
    atingimentoMeta,
    serieReceita,
  };
}
