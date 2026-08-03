import "server-only";

import {
  calcularFaturamentoDoMes,
  type ComponenteParaFaturamento,
  type FaturamentoDoMes,
  type ParcelaParaFaturamento,
} from "@/domain/vendas/valor-presente";
import { listarComponentesParaFaturamento } from "@/server/repositories/componente.repo";
import { listarRecebimentosDoMesComOrigem } from "@/server/repositories/recebimento.repo";

// Fachada de leitura do faturamento de uma competência (Fase 11 / PGMT-03;
// consumida pela Fase 12 / FATUR-01..06). Mesmo padrão dos demais services:
// busca do banco, converte Decimal→number UMA vez na fronteira, e delega
// TODA a soma para o módulo puro (src/domain/vendas/valor-presente.ts).
// NÃO faz authz (fica na página/action).

/** Converte um `Date` (@db.Date) para "YYYY-MM-01" via getters UTC — nunca
 * `.toISOString()`. Mesma convenção de recebimento.service.ts (Pitfall 6). */
function mesParaString(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}-01`;
}

/**
 * TCV, valor presente e caixa de uma competência — os três números que a §2
 * do documento de apuração exige que estejam visíveis ao mesmo tempo.
 *
 * COMPATIBILIDADE COM O HISTÓRICO (importante enquanto o backfill não rodou):
 * uma parcela sem componente vinculado entra como `origemContaCheio: false`,
 * ou seja, é tratada como parcela de recorrência — conta no valor presente
 * quando paga. Para as vendas históricas (Fase 10) esse é o comportamento
 * correto e conservador: elas não têm componente, e o valor presente delas
 * passa a ser exatamente o caixa, que é o que o v1 já reportava. Vendas com
 * cartão parcelado só passam a contar cheio DEPOIS de convertidas pelo
 * backfill (scripts/backfill-componentes.ts).
 */
export async function getFaturamentoDoMes(
  mesReferencia: string,
): Promise<FaturamentoDoMes> {
  const [componentesRaw, parcelasRaw] = await Promise.all([
    listarComponentesParaFaturamento(mesReferencia),
    listarRecebimentosDoMesComOrigem(mesReferencia),
  ]);

  const componentes: ComponenteParaFaturamento[] = componentesRaw.map((c) => ({
    vendaId: c.vendaId,
    vendaMesReferencia: mesParaString(c.venda.mesReferencia),
    forma: c.forma,
    contaCheioNoMes: c.contaCheioNoMes,
    valor: Number(c.valor),
    mesPrevisto: mesParaString(c.mesPrevisto),
  }));

  const parcelasRecebidas: ParcelaParaFaturamento[] = parcelasRaw.map((p) => ({
    parcelaId: p.id,
    vendaId: p.vendaId,
    vendaMesReferencia: mesParaString(p.venda.mesReferencia),
    mesReferencia: mesParaString(p.mesReferencia),
    valorRecebido: p.valorRecebido !== null ? Number(p.valorRecebido) : 0,
    // Sem componente vinculado (histórico) → false. Ver nota acima.
    origemContaCheio: p.componente?.contaCheioNoMes ?? false,
  }));

  return calcularFaturamentoDoMes({
    componentes,
    parcelasRecebidas,
    mesReferencia,
  });
}
