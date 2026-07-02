// Módulo PURO de normalização/mapeamento da planilha histórica
// (Comissões_Vendas - NEXT.xlsx) para os fatos brutos que o resto do
// pipeline de importação (Fase 10, IMPORT-01/02/03) consome. Sem
// server-only, sem @prisma/client, sem xlsx — só transformação de dados já
// lidos em memória (linhas como array de valores), testável isoladamente
// (ver import/normalizacao.test.ts).
//
// Pitfall 9: este módulo NUNCA copia a coluna FÓRMULA/COMISSÃO como
// "verdade" — ele só normaliza os FATOS brutos (valores, datas, %, nomes).
// A recomputação da comissão em si acontece em import/reconciliacao.ts, a
// partir do % histórico da linha (fato) × valorRecebido (fato).

export type LinhaBruta = {
  data: unknown;
  aluno: unknown;
  pagador: unknown;
  plataforma: unknown;
  produto: unknown;
  tipoPgto: unknown;
  valorTotal: unknown;
  entrada: unknown;
  mensalidade: unknown;
  parcela: unknown;
  diaVencimento: unknown;
  mesReferencia: unknown;
  obs: unknown;
  status: unknown;
  closer: unknown;
  percentualCloser: unknown;
  comissaoCloser: unknown;
  sdr: unknown;
  percentualSdr: unknown;
  comissaoSdr: unknown;
  formula: unknown;
};

export type VendaNormalizada = {
  dataVenda: string; // "YYYY-MM-DD"
  alunoNome: string;
  pagadorNome: string;
  plataforma: "ASAAS" | "PAGARME" | "INTER" | "GURU" | "OUTRO";
  produtoNome: string;
  tipoPagamento: "A_VISTA" | "MENSALISTA";
  valorTotal: number;
  entrada: number;
  valorMensalidade: number;
  diaVencimento: number;
  mesReferencia: string; // "YYYY-MM-01"
  observacao: string | null;
  pago: boolean;
  closerNome: string | null;
  percentualCloser: number | null; // fração histórica da linha (fato bruto)
  sdrNome: string | null;
  percentualSdr: number | null;
  valorRecebidoNoMes: number; // FÓRMULA — fato bruto "valor recebido no mês", nunca a comissão
};

export type LinhaRejeitada = {
  linha: number;
  motivo: string;
  bruta: LinhaBruta;
};

// Rótulos que aparecem na coluna CLOSER/SDR mas NÃO são nomes de pessoa —
// são categorias/tags que a planilha usa para marcar origem do lead
// (IMERSÃO, RENOVAÇÃO, INDICAÇÃO, UPGRADE, OUTBOUND, SS genérico, OTE como
// placeholder de "sem % definido ainda"). Tratadas como "sem SDR atribuído"
// em vez de criar um Colaborador fantasma com esse nome.
const ROTULOS_NAO_PESSOA = new Set([
  "SS",
  "OTE",
  "IMERSÃO",
  "IMERSAO",
  "RENOVAÇÃO",
  "RENOVACAO",
  "INDICAÇÃO",
  "INDICACAO",
  "UPGRADE",
  "OUTBOUND",
  "-",
]);

const MESES_PT: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  março: 3,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

/** "-", "", null, undefined, só espaços => vazio. */
export function ehVazio(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  return s === "" || s === "-" || s.toLowerCase() === "n/a";
}

/** Remove espaços extras (inclusive múltiplos/trailing) de um nome. */
export function limparNome(v: unknown): string {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converte qualquer representação de data da planilha (Date do openpyxl/
 * SheetJS com cellDates:true, ou string "YYYY-MM-DD HH:MM:SS") para
 * "YYYY-MM-DD" usando getters UTC (Pitfall 6) — nunca local time.
 */
export function paraDataISO(v: unknown): string | null {
  if (ehVazio(v)) return null;

  if (v instanceof Date) {
    const ano = v.getUTCFullYear();
    const mes = String(v.getUTCMonth() + 1).padStart(2, "0");
    const dia = String(v.getUTCDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  const s = String(v).trim();
  // "YYYY-MM-DD HH:MM:SS" ou "YYYY-MM-DD"
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  // "DD/MM/YYYY"
  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

/** Nome do mês em pt-BR (com/sem acento, qualquer caixa) => número 1-12, ou null. */
export function mesPtParaNumero(v: unknown): number | null {
  if (ehVazio(v)) return null;
  const chave = String(v).trim().toLowerCase();
  return MESES_PT[chave] ?? null;
}

/**
 * "MÊS DE REFERÊNCIA" da planilha é só o NOME do mês (ex.: "Dezembro"), sem
 * ano — o ano é inferido a partir do ano da aba/pagamento consultando a
 * DATA da linha (mesmo ano, ou ano-1 se o mês de referência for posterior ao
 * mês da data, cobrindo o caso comum "venda em dez/25, referência dez" vs.
 * cronogramas que cruzam virada de ano). Retorna "YYYY-MM-01".
 */
export function inferirMesReferencia(
  mesRefNome: unknown,
  dataVendaISO: string | null,
): string | null {
  const mesNum = mesPtParaNumero(mesRefNome);
  if (mesNum === null) return null;

  // Sem data de venda para ancorar o ano: não há como inferir com segurança.
  if (!dataVendaISO) return null;

  const anoVenda = Number(dataVendaISO.slice(0, 4));
  const mesVenda = Number(dataVendaISO.slice(5, 7));

  // Regra: se o mês de referência for "muito maior" que o mês da venda
  // (>6 meses à frente), assume-se que pertence ao ano ANTERIOR ao da venda
  // (referência de final de ano anterior sendo paga início do ano
  // seguinte); caso contrário mesmo ano da venda. Cobre o padrão observado
  // nas planilhas (aba paga em mês N+1, referência quase sempre no mesmo
  // ano civil da venda, exceto na virada dez/jan).
  let ano = anoVenda;
  if (mesNum - mesVenda > 6) {
    ano = anoVenda - 1;
  } else if (mesVenda - mesNum > 6) {
    ano = anoVenda + 1;
  }

  return `${ano}-${String(mesNum).padStart(2, "0")}-01`;
}

/** Converte texto/numero de dinheiro pt-BR ou já-numérico para number, ou null se vazio/inválido. */
export function paraNumero(v: unknown): number | null {
  if (ehVazio(v)) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  let s = String(v).trim();
  // Remove "R$", espaços.
  s = s.replace(/R\$\s?/gi, "").trim();
  // Formato pt-BR "1.234,56" -> "1234.56"; formato já com ponto decimal
  // "1234.56" passa direto (openpyxl/SheetJS geralmente já entregam number).
  if (/^-?\d{1,3}(\.\d{3})*,\d+$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "% COMISSÃO CLOSER/SDR": aceita fração (0.03), percentual inteiro (3) ou "-"/"OTE" (=> null). */
export function paraPercentual(v: unknown): number | null {
  if (ehVazio(v)) return null;
  const s = String(v).trim().toUpperCase();
  if (ROTULOS_NAO_PESSOA.has(s)) return null;
  const n = paraNumero(v);
  if (n === null) return null;
  // Frações já vêm como 0.03 na maioria das linhas; nunca > 1 nas plataformas
  // observadas, então não há ambiguidade "3 significa 3% ou 300%" a resolver
  // aqui — mantemos o valor como está (fração).
  return n;
}

export function mapearPlataforma(
  v: unknown,
): VendaNormalizada["plataforma"] {
  const s = limparNome(v).toUpperCase();
  if (s.includes("ASAAS")) return "ASAAS";
  if (s.includes("PAGAR")) return "PAGARME";
  if (s.includes("INTER")) return "INTER";
  if (s.includes("GURU")) return "GURU";
  return "OUTRO";
}

export function mapearTipoPagamento(
  v: unknown,
): VendaNormalizada["tipoPagamento"] | null {
  const s = limparNome(v).toLowerCase();
  if (s.includes("vista")) return "A_VISTA";
  if (s.includes("mensal")) return "MENSALISTA";
  return null;
}

/** Nome de closer/SDR: rótulo de categoria (SS/OTE/IMERSÃO/...) ou "-" => null (sem pessoa). */
export function nomeOuNulo(v: unknown): string | null {
  if (ehVazio(v)) return null;
  const nome = limparNome(v);
  if (nome === "") return null;
  if (ROTULOS_NAO_PESSOA.has(nome.toUpperCase())) return null;
  return nome;
}

/**
 * Linha é uma linha de RODAPÉ/TOTAIS (não uma venda) quando a célula da
 * coluna "TIPO DE PGTO" contiver "RECEITA GERADA", ou quando ALUNO e DATA
 * estiverem ambos vazios mas houver algo na linha (marcador de totais).
 */
export function ehLinhaRodape(bruta: LinhaBruta): boolean {
  const tipo = limparNome(bruta.tipoPgto).toUpperCase();
  if (tipo.includes("RECEITA GERADA")) return true;
  if (tipo.includes("TOTAL")) return true;
  return false;
}

/** Linha inteiramente vazia (sem aluno, sem data, sem valor) — pular silenciosamente, não é erro. */
export function ehLinhaVazia(bruta: LinhaBruta): boolean {
  return (
    ehVazio(bruta.aluno) && ehVazio(bruta.data) && ehVazio(bruta.valorTotal)
  );
}

export type NormalizarResultado =
  | { ok: true; venda: VendaNormalizada }
  | { ok: false; motivo: string };

/**
 * FUNÇÃO PRINCIPAL — normaliza uma linha bruta de venda em
 * `VendaNormalizada`, ou retorna o motivo pelo qual a linha foi rejeitada
 * (nunca lança; toda rejeição é reportada, nunca silenciosamente descartada
 * — exceto linhas vazias/rodapé, tratadas antes de chamar esta função).
 */
export function normalizarLinhaVenda(bruta: LinhaBruta): NormalizarResultado {
  const dataVenda = paraDataISO(bruta.data);
  if (!dataVenda) {
    return { ok: false, motivo: "DATA ausente ou ilegível" };
  }

  const alunoNome = limparNome(bruta.aluno);
  if (alunoNome === "") {
    return { ok: false, motivo: "ALUNO ausente" };
  }

  const valorTotal = paraNumero(bruta.valorTotal);
  if (valorTotal === null || valorTotal <= 0) {
    return { ok: false, motivo: "VALOR TOTAL DA VENDA ausente ou inválido" };
  }

  const tipoPagamento = mapearTipoPagamento(bruta.tipoPgto);
  if (!tipoPagamento) {
    return { ok: false, motivo: "TIPO DE PGTO não reconhecido" };
  }

  const mesReferencia = inferirMesReferencia(bruta.mesReferencia, dataVenda);
  if (!mesReferencia) {
    return {
      ok: false,
      motivo: "MÊS DE REFERÊNCIA ausente ou não reconhecido",
    };
  }

  const produtoNome = limparNome(bruta.produto) || "SEM PRODUTO";

  const pagadorNome = limparNome(bruta.pagador) || alunoNome;

  const entrada = paraNumero(bruta.entrada) ?? 0;
  const valorMensalidade = paraNumero(bruta.mensalidade) ?? 0;

  const diaVencimentoBruto = paraNumero(bruta.diaVencimento);
  const diaVencimento =
    diaVencimentoBruto && diaVencimentoBruto >= 1 && diaVencimentoBruto <= 31
      ? Math.trunc(diaVencimentoBruto)
      : new Date(`${dataVenda}T00:00:00Z`).getUTCDate();

  const status = limparNome(bruta.status).toLowerCase();
  const pago = status === "pago";

  // FÓRMULA representa "valor recebido no mês" (fato bruto, Pitfall 9) — só
  // é positivo/confiável em linhas Pago; em Pendente é 0 por definição
  // (PGTO-03: pendente conta como zero). Algumas abas (ex.: "JULPGTO AGO",
  // "JUNPGTO JUL") não têm coluna FÓRMULA/CHECK nenhuma — nesse caso, o
  // valor recebido daquela linha é inferido do próprio fato bruto já
  // presente: para À VISTA é o VALOR TOTAL DA VENDA inteiro (recebido de
  // uma vez); para MENSALISTA é o valor da MENSALIDADE daquela parcela
  // específica (a linha representa uma parcela paga, não o TCV). Nunca
  // inventa um valor quando FÓRMULA existe e é 0 de propósito.
  const formulaBruta = paraNumero(bruta.formula);
  const valorRecebidoInferido =
    formulaBruta ??
    (tipoPagamento === "A_VISTA" ? valorTotal : valorMensalidade || entrada);
  const valorRecebidoNoMes = pago ? valorRecebidoInferido : 0;

  return {
    ok: true,
    venda: {
      dataVenda,
      alunoNome,
      pagadorNome,
      plataforma: mapearPlataforma(bruta.plataforma),
      produtoNome,
      tipoPagamento,
      valorTotal,
      entrada: tipoPagamento === "MENSALISTA" ? entrada : 0,
      valorMensalidade: tipoPagamento === "MENSALISTA" ? valorMensalidade : 0,
      diaVencimento,
      mesReferencia,
      observacao: ehVazio(bruta.obs) ? null : limparNome(bruta.obs),
      pago,
      closerNome: nomeOuNulo(bruta.closer),
      percentualCloser: paraPercentual(bruta.percentualCloser),
      sdrNome: nomeOuNulo(bruta.sdr),
      percentualSdr: paraPercentual(bruta.percentualSdr),
      valorRecebidoNoMes,
    },
  };
}
