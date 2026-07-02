// Módulo PURO de recomputação + reconciliação de comissão histórica
// (IMPORT-02, Pitfall 9). NUNCA copia a coluna COMISSÃO CLOSER/SDR da
// planilha como verdade — recomputa comissão = valorRecebidoNoMes (FÓRMULA,
// fato bruto) × percentualCloser/percentualSdr (fato bruto, histórico da
// própria linha), usando o MESMO helper de arredondamento do motor real
// (src/domain/comissao/money.ts) para não introduzir um segundo padrão de
// arredondamento. Compara o total recomputado por (mês, pessoa) contra o
// valor que a própria planilha registrou na linha (coluna COMISSÃO
// CLOSER/SDR) somado — a fonte de comparação é a SOMA das linhas
// individuais, não o rodapé (rodapé mistura renovações/parceiros com
// layout inconsistente entre abas, ver PITFALLS.md).
import { arredondar, toDecimal } from "@/domain/comissao/money";
import type { VendaNormalizada } from "./normalizacao";
import { paraNumero } from "./normalizacao";

export type LinhaParaReconciliar = {
  numeroLinha: number;
  nomeAba: string;
  venda: VendaNormalizada;
  comissaoCloserPlanilha: unknown; // coluna "COMISSÃO CLOSER" bruta, só para comparação
  comissaoSdrPlanilha: unknown; // coluna "COMISSÃO SDR" bruta, só para comparação
};

export type DivergenciaLinha = {
  numeroLinha: number;
  nomeAba: string;
  alunoNome: string;
  papel: "CLOSER" | "SDR";
  pessoa: string;
  recomputado: number;
  planilha: number;
  diferenca: number;
};

export type RecomputoLinha = {
  numeroLinha: number;
  nomeAba: string;
  closerNome: string | null;
  comissaoCloserRecomputada: number | null;
  sdrNome: string | null;
  comissaoSdrRecomputada: number | null;
};

/** Recomputa a comissão de UMA linha (closer e/ou SDR) a partir dos fatos brutos. */
export function recomputarComissaoLinha(
  venda: VendaNormalizada,
): { closer: number | null; sdr: number | null } {
  const closer =
    venda.closerNome && venda.percentualCloser !== null
      ? arredondar(
          toDecimal(venda.valorRecebidoNoMes).times(venda.percentualCloser),
        )
      : null;

  const sdr =
    venda.sdrNome && venda.percentualSdr !== null
      ? arredondar(
          toDecimal(venda.valorRecebidoNoMes).times(venda.percentualSdr),
        )
      : null;

  return { closer, sdr };
}

// Tolerância de reconciliação: até R$0,05 de diferença por linha é
// atribuída a arredondamento intermediário já presente na planilha original
// (que às vezes arredonda o % antes de multiplicar) — acima disso é
// reportado como divergência real para investigação humana (Pitfall 9: never
// silently ignore, but a fixed rounding-noise floor avoids drowning genuine
// findings in cosmetic cent-level noise).
const TOLERANCIA_CENTAVOS = 0.05;

/**
 * Compara, linha a linha, o valor recomputado contra o valor que a própria
 * planilha tinha na coluna COMISSÃO CLOSER/SDR (não o rodapé) — cada
 * divergência acima da tolerância vira uma entrada no relatório.
 */
export function reconciliarLinhas(
  linhas: LinhaParaReconciliar[],
): DivergenciaLinha[] {
  const divergencias: DivergenciaLinha[] = [];

  for (const linha of linhas) {
    const { venda } = linha;
    const { closer, sdr } = recomputarComissaoLinha(venda);

    if (venda.closerNome && closer !== null) {
      const planilhaValor = paraNumero(linha.comissaoCloserPlanilha);
      if (planilhaValor !== null) {
        const diferenca = Math.abs(closer - planilhaValor);
        if (diferenca > TOLERANCIA_CENTAVOS) {
          divergencias.push({
            numeroLinha: linha.numeroLinha,
            nomeAba: linha.nomeAba,
            alunoNome: venda.alunoNome,
            papel: "CLOSER",
            pessoa: venda.closerNome,
            recomputado: closer,
            planilha: planilhaValor,
            diferenca,
          });
        }
      }
    }

    if (venda.sdrNome && sdr !== null) {
      const planilhaValor = paraNumero(linha.comissaoSdrPlanilha);
      if (planilhaValor !== null) {
        const diferenca = Math.abs(sdr - planilhaValor);
        if (diferenca > TOLERANCIA_CENTAVOS) {
          divergencias.push({
            numeroLinha: linha.numeroLinha,
            nomeAba: linha.nomeAba,
            alunoNome: venda.alunoNome,
            papel: "SDR",
            pessoa: venda.sdrNome,
            recomputado: sdr,
            planilha: planilhaValor,
            diferenca,
          });
        }
      }
    }
  }

  return divergencias;
}

export type TotalPorPessoaMes = {
  pessoa: string;
  papel: "CLOSER" | "SDR";
  mesReferencia: string;
  totalRecomputado: number;
  totalPlanilha: number;
  diferenca: number;
  numeroLinhas: number;
};

/**
 * Agrega o recomputado × o valor-de-linha da planilha por (pessoa, papel,
 * mês de referência) — a tabela que vai para o relatório de reconciliação
 * (IMPORT-02: "mês, pessoa, total recomputado, total planilha, diferença").
 */
export function agregarPorPessoaMes(
  linhas: LinhaParaReconciliar[],
): TotalPorPessoaMes[] {
  const mapa = new Map<string, TotalPorPessoaMes>();

  function acumular(
    pessoa: string,
    papel: "CLOSER" | "SDR",
    mesReferencia: string,
    recomputado: number,
    planilhaValor: number | null,
  ) {
    const chave = `${papel}|${pessoa}|${mesReferencia}`;
    const atual = mapa.get(chave) ?? {
      pessoa,
      papel,
      mesReferencia,
      totalRecomputado: 0,
      totalPlanilha: 0,
      diferenca: 0,
      numeroLinhas: 0,
    };
    atual.totalRecomputado = arredondar(
      toDecimal(atual.totalRecomputado).plus(recomputado),
    );
    atual.totalPlanilha = arredondar(
      toDecimal(atual.totalPlanilha).plus(planilhaValor ?? 0),
    );
    atual.diferenca = arredondar(
      toDecimal(atual.totalRecomputado).minus(atual.totalPlanilha),
    );
    atual.numeroLinhas += 1;
    mapa.set(chave, atual);
  }

  for (const linha of linhas) {
    const { venda } = linha;
    const { closer, sdr } = recomputarComissaoLinha(venda);

    if (venda.closerNome && closer !== null) {
      acumular(
        venda.closerNome,
        "CLOSER",
        venda.mesReferencia,
        closer,
        paraNumero(linha.comissaoCloserPlanilha),
      );
    }
    if (venda.sdrNome && sdr !== null) {
      acumular(
        venda.sdrNome,
        "SDR",
        venda.mesReferencia,
        sdr,
        paraNumero(linha.comissaoSdrPlanilha),
      );
    }
  }

  return Array.from(mapa.values()).sort(
    (a, b) =>
      a.mesReferencia.localeCompare(b.mesReferencia) ||
      a.papel.localeCompare(b.papel) ||
      a.pessoa.localeCompare(b.pessoa),
  );
}
