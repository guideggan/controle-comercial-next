// Camada de leitura das planilhas via SheetJS — a ÚNICA parte do pipeline
// que sabe abrir um .xlsx. Traduz cada aba "PGTO" em `LinhaBruta[]`
// (import/normalizacao.ts), parando no marcador de rodapé ("RECEITA
// GERADA"). Não normaliza nem valida nada aqui — só extrai.
import * as XLSX from "xlsx";
import type { LinhaBruta } from "./normalizacao";
import { ehLinhaRodape, ehLinhaVazia } from "./normalizacao";

// As 12 abas mensais "<MÊS>PGTO <MÊS PAGAMENTO>" com o layout de 21-22
// colunas padrão (DATA..FORMÚLA). Abas especiais (IMERSÃO, PIX IMERSÃO,
// Deshboard, FINANCEIRO) têm estruturas totalmente diferentes (tracking de
// leads, aba de conciliação contábil) e são explicitamente FORA de escopo
// desta importação (ver IMPORT-01 no PLAN/SUMMARY) — nunca processadas
// silenciosamente, sempre listadas como puladas no relatório.
const SUFIXOS_ABA_MENSAL = "PGTO";
const ABAS_EXCLUIDAS = new Set([
  "Deshboard",
  "IMERSÃOPGTO JULHO",
  "PIX IMERSÃO",
  "FINANCEIRO AGOSTO - FAVOR NÃO M",
  "FINANCEIRO - NÃO MEXER",
]);

export type AbaLida = {
  nomeAba: string;
  linhas: { numeroLinha: number; bruta: LinhaBruta }[];
  paradaPorRodape: boolean;
};

// Índice de coluna (0-based) por nome de cabeçalho conhecido — a ordem varia
// levemente entre abas (algumas não têm COMPROVANTE/PLATAFORMA), então
// resolvemos por NOME do cabeçalho normalizado, nunca por posição fixa.
function normalizarCabecalho(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // remove acentos
}

const MAPA_CABECALHOS: Record<string, keyof LinhaBruta> = {
  DATA: "data",
  "DATA DA VENDA": "data",
  ALUNO: "aluno",
  "PAGADOR (NOME DO PAGADOR)": "pagador",
  COMPROVANTE: "aluno", // nunca usado como campo próprio; ignorado via overwrite abaixo
  PLATAFORMA: "plataforma",
  PRODUTO: "produto",
  "TIPO DE PGTO": "tipoPgto",
  "VALOR TOTAL DA VENDA": "valorTotal",
  ENTRADA: "entrada",
  MENSALIDADE: "mensalidade",
  PARCELA: "parcela",
  "DIA VENCIMENTO": "diaVencimento",
  "MES DE REFERENCIA": "mesReferencia",
  OBS: "obs",
  STATUS: "status",
  CLOSER: "closer",
  "% COMISSAO CLOSER": "percentualCloser",
  "COMISSAO CLOSER": "comissaoCloser",
  SDR: "sdr",
  "% COMISSAO SDR": "percentualSdr",
  "COMISSAO SDR": "comissaoSdr",
  FORMULA: "formula",
  CHECK: "formula", // algumas abas renomeiam a última coluna para CHECK, mesmo papel
};

/** Lista os nomes das abas "PGTO" reconhecidas (mensais, layout padrão) — exclui as especiais. */
export function listarAbasMensais(workbook: XLSX.WorkBook): string[] {
  return workbook.SheetNames.filter(
    (nome) => nome.includes(SUFIXOS_ABA_MENSAL) && !ABAS_EXCLUIDAS.has(nome),
  );
}

export function listarAbasIgnoradas(workbook: XLSX.WorkBook): string[] {
  return workbook.SheetNames.filter(
    (nome) => !nome.includes(SUFIXOS_ABA_MENSAL) || ABAS_EXCLUIDAS.has(nome),
  );
}

function construirMapaColunas(headerRow: unknown[]): Map<number, keyof LinhaBruta> {
  const mapa = new Map<number, keyof LinhaBruta>();
  headerRow.forEach((valorBruto, idx) => {
    const chave = normalizarCabecalho(valorBruto);
    const campo = MAPA_CABECALHOS[chave];
    // "COMPROVANTE" mapeia para "aluno" acima só como placeholder para não
    // ficar undefined — nunca sobrescreve de fato porque a coluna ALUNO real
    // já tem seu próprio índice mapeado corretamente antes/depois; aqui só
    // pulamos colunas sem mapeamento conhecido.
    if (campo && chave !== "COMPROVANTE") {
      mapa.set(idx, campo);
    }
  });

  // Fallback posicional: em pelo menos uma aba real (" MAIOPGTO JUNHO") o
  // cabeçalho da coluna A veio vazio (célula sem texto, provavelmente um
  // resquício de edição manual) mas o LAYOUT da linha é idêntico às demais
  // abas mensais (DATA sempre na coluna A). Sem esse fallback a coluna
  // inteira ficaria sem mapeamento e toda a aba seria rejeitada por "DATA
  // ausente" — em vez disso, se a coluna 0 não foi mapeada por nome mas
  // "aluno" já está mapeado exatamente na coluna 1 (confirma que é o layout
  // padrão), assumimos coluna 0 = "data".
  if (!mapa.has(0) && mapa.get(1) === "aluno") {
    mapa.set(0, "data");
  }

  return mapa;
}

const MARCADORES_RODAPE = ["RECEITA GERADA", "TOTAL COMISS", "TOTAL:"];

/** Varre a linha bruta (todas as colunas, mapeadas ou não) por qualquer marcador conhecido de rodapé/totais. */
function linhaContemMarcadorRodape(row: unknown[]): boolean {
  return row.some((celula) => {
    if (celula === null || celula === undefined) return false;
    const texto = String(celula).toUpperCase();
    return MARCADORES_RODAPE.some((marcador) => texto.includes(marcador));
  });
}

function linhaVaziaObj(): LinhaBruta {
  return {
    data: null,
    aluno: null,
    pagador: null,
    plataforma: null,
    produto: null,
    tipoPgto: null,
    valorTotal: null,
    entrada: null,
    mensalidade: null,
    parcela: null,
    diaVencimento: null,
    mesReferencia: null,
    obs: null,
    status: null,
    closer: null,
    percentualCloser: null,
    comissaoCloser: null,
    sdr: null,
    percentualSdr: null,
    comissaoSdr: null,
    formula: null,
  };
}

/**
 * Lê uma aba mensal inteira: cabeçalho na linha 1, dados a partir da linha
 * 2, parando na primeira linha de rodapé ("RECEITA GERADA") ou ao fim dos
 * dados. Linhas totalmente vazias no meio são puladas (não param a leitura
 * — algumas abas têm um espaçamento em branco antes do rodapé).
 */
export function lerAbaMensal(
  workbook: XLSX.WorkBook,
  nomeAba: string,
): AbaLida {
  const ws = workbook.Sheets[nomeAba];
  const matriz: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
  });

  const headerRow = matriz[0] ?? [];
  const mapaColunas = construirMapaColunas(headerRow);

  const linhas: { numeroLinha: number; bruta: LinhaBruta }[] = [];
  let paradaPorRodape = false;

  for (let i = 1; i < matriz.length; i++) {
    const row = matriz[i] ?? [];
    const bruta = linhaVaziaObj();
    mapaColunas.forEach((campo, idx) => {
      (bruta as Record<string, unknown>)[campo] = row[idx] ?? null;
    });

    // O marcador de rodapé nem sempre cai na coluna mapeada como
    // "tipoPgto" — em abas com layout de colunas reduzido (ex.: "JULPGTO
    // AGO"), "TOTAL COMISSÕES CLOSERS"/"TOTAL COMISSÕES SDR" aparece em
    // outras colunas da mesma linha de totais. Por isso escaneamos a linha
    // BRUTA inteira (antes do mapeamento) além do campo já mapeado.
    if (ehLinhaRodape(bruta) || linhaContemMarcadorRodape(row)) {
      paradaPorRodape = true;
      break;
    }
    if (ehLinhaVazia(bruta)) {
      continue;
    }

    // numeroLinha 1-based + 1 (linha 1 é cabeçalho), igual ao número de
    // linha que o Excel mostraria — facilita o admin localizar a linha
    // original ao investigar uma rejeição no relatório.
    linhas.push({ numeroLinha: i + 1, bruta });
  }

  return { nomeAba, linhas, paradaPorRodape };
}

export function abrirWorkbook(caminho: string): XLSX.WorkBook {
  // cellDates:true (Pitfall Excel serial dates) — datas viram objetos Date
  // já resolvidos, nunca números seriais crus.
  return XLSX.readFile(caminho, { cellDates: true });
}
