// Módulo PURO de domínio: cronograma de parcelas de uma venda + dia de
// vencimento ancorado (VENDA-02/VENDA-03). Sem `server-only`, sem import de
// `@prisma/client`/`@/lib/db` — testável isoladamente e reutilizável pelo
// motor de comissão (Fase 5) e pela importação de histórico (Fase 10).
//
// Convenção de datas (PITFALLS Pitfall 6/7): toda data é string "YYYY-MM-DD"
// (ou "YYYY-MM" para mês de referência). NUNCA fazemos round-trip por
// `new Date(string)` ciente de timezone local — só `Date.UTC` na entrada e
// getters `getUTC*` na saída, como em plano-comissao.service.ts.
//
// Dinheiro aqui é `number` puro: só distribuímos valores já conhecidos
// (entrada, valorMensalidade, valorTotal). O arredondamento de comissão
// fica isolado na Fase 5.

export type TipoPagamento = "a_vista" | "mensalista";

export type TipoParcela = "ENTRADA" | "MENSALIDADE" | "AVISTA";

export interface GerarCronogramaParcelasInput {
  tipoPagamento: TipoPagamento;
  /** "YYYY-MM" ou "YYYY-MM-01" — mês da 1ª parcela do cronograma. */
  mesReferenciaInicial: string;
  /** Dia âncora do vencimento, 1..31. */
  diaVencimento: number;
  valorTotal: number;
  entrada: number;
  valorMensalidade: number;
  numeroParcelas: number;
}

export interface ParcelaGerada {
  tipo: TipoParcela;
  numero: number;
  /** Sempre normalizado para "YYYY-MM-01". */
  mesReferencia: string;
  /** "YYYY-MM-DD", ancorada a partir do diaVencimento original. */
  dataVencimento: string;
  valorPrevisto: number;
}

/**
 * Normaliza "YYYY-MM" ou "YYYY-MM-01" para os componentes numéricos
 * {ano, mes} (mes 1-based). Único ponto de parsing de string de mês do
 * módulo — evita repetir `.split("-")` em cada função.
 */
function parseAnoMes(anoMes: string): { ano: number; mes: number } {
  const [anoStr, mesStr] = anoMes.split("-");
  return { ano: Number(anoStr), mes: Number(mesStr) };
}

/**
 * Último dia do mês {ano, mes} (mes 1-based). `Date.UTC(ano, mes, 0)` usa o
 * comportamento de overflow do JS: "dia 0 do mês seguinte" é sempre o
 * último dia do mês atual, sem precisar de tabela de dias-por-mês nem de
 * lógica própria de ano bissexto.
 */
function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * FUNÇÃO 1 — dia de vencimento ancorado (Pitfall 7).
 *
 * Retorna "YYYY-MM-DD" com dia = min(diaAncora, últimoDiaDoMês(anoMes]).
 *
 * CRÍTICO: o clamp é sempre calculado a partir do `diaAncora` ORIGINAL
 * recebido pelo caller, nunca a partir do resultado (já clampado) do mês
 * anterior. Isso é o que garante que fevereiro (âncora 31 → 28/29) não
 * "contamina" março, que volta a cair em 31 — sem essa disciplina, um
 * cronograma ingênuo que reaplicasse o dia do mês anterior faria o
 * vencimento derivar (drift) para sempre mais cedo a partir do primeiro
 * mês curto.
 */
export function dataVencimentoAncorada(
  anoMes: string,
  diaAncora: number,
): string {
  const { ano, mes } = parseAnoMes(anoMes);
  const dia = Math.min(diaAncora, ultimoDiaDoMes(ano, mes));

  const mesStr = String(mes).padStart(2, "0");
  const diaStr = String(dia).padStart(2, "0");
  return `${ano}-${mesStr}-${diaStr}`;
}

/**
 * FUNÇÃO 2 — avança um mês em cima dos componentes de calendário (nunca
 * somando 30/31 dias em cima de um Date, o que arrastaria o dia junto e
 * reintroduziria o drift do Pitfall 7). Retorna "YYYY-MM".
 */
export function proximoMes(anoMes: string): string {
  const { ano, mes } = parseAnoMes(anoMes);
  // Date.UTC normaliza mes=12 (0-based 12) automaticamente para janeiro do
  // ano seguinte — não precisamos de if/else para o rollover de ano.
  const data = new Date(Date.UTC(ano, mes, 1));
  const anoSeguinte = data.getUTCFullYear();
  const mesSeguinte = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${anoSeguinte}-${mesSeguinte}`;
}

/** Normaliza qualquer "YYYY-MM" ou "YYYY-MM-DD" para "YYYY-MM-01". */
function normalizarMesReferencia(anoMes: string): string {
  const { ano, mes } = parseAnoMes(anoMes);
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

/**
 * FUNÇÃO 3 — gera o cronograma completo de parcelas de uma venda.
 *
 * Regras (VENDA-02):
 * - a_vista: 1 única parcela AVISTA no mês inicial, valorPrevisto = valorTotal.
 * - mensalista com entrada > 0: 1 parcela ENTRADA no mês inicial, seguida de
 *   N parcelas MENSALIDADE começando no mês SEGUINTE (a entrada ocupa
 *   sozinha o mês inicial — entrada e mensalidade nunca competem na mesma
 *   competência).
 * - mensalista com entrada == 0: N parcelas MENSALIDADE começando no
 *   próprio mês inicial (numero 1..N).
 *
 * Cada dataVencimento é recalculada por `dataVencimentoAncorada` a partir
 * do `diaVencimento` original a cada mês — nunca herdada do mês anterior.
 */
export function gerarCronogramaParcelas(
  input: GerarCronogramaParcelasInput,
): ParcelaGerada[] {
  const {
    tipoPagamento,
    mesReferenciaInicial,
    diaVencimento,
    valorTotal,
    entrada,
    valorMensalidade,
    numeroParcelas,
  } = input;

  if (tipoPagamento === "a_vista") {
    return [
      {
        tipo: "AVISTA",
        numero: 0,
        mesReferencia: normalizarMesReferencia(mesReferenciaInicial),
        dataVencimento: dataVencimentoAncorada(
          mesReferenciaInicial,
          diaVencimento,
        ),
        valorPrevisto: valorTotal,
      },
    ];
  }

  // mensalista
  const parcelas: ParcelaGerada[] = [];
  let mesCorrente = mesReferenciaInicial;

  if (entrada > 0) {
    parcelas.push({
      tipo: "ENTRADA",
      numero: 0,
      mesReferencia: normalizarMesReferencia(mesCorrente),
      dataVencimento: dataVencimentoAncorada(mesCorrente, diaVencimento),
      valorPrevisto: entrada,
    });
    // Mensalidades começam no mês seguinte ao da entrada.
    mesCorrente = proximoMes(mesCorrente);
  }

  for (let numero = 1; numero <= numeroParcelas; numero++) {
    parcelas.push({
      tipo: "MENSALIDADE",
      numero,
      mesReferencia: normalizarMesReferencia(mesCorrente),
      dataVencimento: dataVencimentoAncorada(mesCorrente, diaVencimento),
      valorPrevisto: valorMensalidade,
    });
    mesCorrente = proximoMes(mesCorrente);
  }

  return parcelas;
}
