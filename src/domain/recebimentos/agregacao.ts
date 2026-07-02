// Módulo PURO de domínio: agregação do "valor recebido no mês" por
// competência e por colaborador (closer/sdr) — o coração da Fase 4
// (PGTO-02/PGTO-03). Sem `server-only`, sem import de `@prisma/client`/
// `@/lib/db` — testável isoladamente e é a fonte única de entrada direta
// do motor de comissão (Fase 5). O service (plano 04-02) é quem busca do
// banco, converte Decimal→number e monta a entrada abaixo.
//
// Convenção de dinheiro (Pitfall 1): `number` puro, já convertido de
// Decimal pelo caller. Somamos valores crus e NÃO arredondamos por parcela
// aqui — arredondamento é responsabilidade do motor/Fase 5, no total.
//
// Convenção de competência (Pitfall 2): `mesReferencia` é sempre string
// "YYYY-MM-01", comparada por igualdade exata de string — nunca derivada de
// outra data.

export type RecebimentoParcela = {
  parcelaId: string;
  vendaId: string;
  tipo: "ENTRADA" | "MENSALIDADE" | "AVISTA";
  mesReferencia: string; // competência "YYYY-MM-01"
  status: "PENDENTE" | "PAGO";
  valorRecebido: number | null; // number puro (Decimal já convertido pelo caller); null quando pendente
  closerId: string;
  sdrId: string | null;
};

export type ResultadoRecebidoNoMes = {
  total: number;
  porCloser: Record<string, number>;
  porSdr: Record<string, number>;
};

/**
 * Agrega o valor recebido em uma competência, somando entrada + mensalidade
 * + à vista SOMENTE quando `status==="PAGO"` (PGTO-03: pendente = zero),
 * deduplicando por `parcelaId` antes de somar (PGTO-02: defesa contra
 * fan-out de join, caso o caller passe a mesma parcela mais de uma vez).
 *
 * A soma por colaborador (`porCloser`/`porSdr`) é apenas um reagrupamento
 * das MESMAS parcelas já deduplicadas — nunca uma soma independente que
 * poderia divergir do `total`.
 */
export function agregarRecebidoNoMes(
  recebimentos: RecebimentoParcela[],
  mesReferencia: string,
): ResultadoRecebidoNoMes {
  // Dedup defensivo por parcelaId: um Map preserva só a última ocorrência de
  // cada parcela, neutralizando joins que fan-out a mesma parcela em mais
  // de uma linha antes de chegar aqui.
  const parcelasUnicas = new Map<string, RecebimentoParcela>();
  for (const parcela of recebimentos) {
    parcelasUnicas.set(parcela.parcelaId, parcela);
  }

  const resultado: ResultadoRecebidoNoMes = {
    total: 0,
    porCloser: {},
    porSdr: {},
  };

  for (const parcela of parcelasUnicas.values()) {
    if (parcela.status !== "PAGO") continue; // PGTO-03: pendente = zero
    if (parcela.mesReferencia !== mesReferencia) continue; // competência exata

    const valor = parcela.valorRecebido ?? 0;

    resultado.total += valor;
    resultado.porCloser[parcela.closerId] =
      (resultado.porCloser[parcela.closerId] ?? 0) + valor;

    if (parcela.sdrId) {
      resultado.porSdr[parcela.sdrId] =
        (resultado.porSdr[parcela.sdrId] ?? 0) + valor;
    }
  }

  return resultado;
}
