// Calculadora PURA do formato `salario_bonus_atingimento` (Closer Jr / OTE).
// Comissão total = salarioFixo (SEMPRE pago, mesmo a 0% de atingimento) +
// bonus da faixa vigente (valor FIXO em R$, NÃO percentual sobre o valor
// recebido — diferente de todos os outros 4 formatos). A faixa escolhida é a
// de maior `minAtingimento` que ainda seja <= atingimentoPercent (mesmo
// critério de seleção de progressivo-atingimento.ts).
//
// CONVENÇÃO DE ESCALA — DIFERENTE de progressivo_atingimento: aqui
// `minAtingimento`/`atingimentoPercent` são PERCENTUAIS inteiros (71 = 71%
// da meta), não frações (0.71). Isso casa 1:1 com as faixas do modelo Closer
// Jr conforme especificado pelo usuário (0/71/86/100/120/150/200). O
// `ComissaoInput.percentualAtingimento` do motor continua sendo uma FRAÇÃO
// (1 = 100%, mesma convenção de progressivo_atingimento) — a conversão
// fração -> percentual acontece em engine.ts, na borda de dispatch.
import { arredondar, toDecimal } from "../money";
import type { ComissaoResultado } from "../types";

export interface FaixaSalarioBonus {
  /** Percentual de atingimento da meta a partir do qual esta faixa vale (ex.: 71 = 71%). */
  minAtingimento: number;
  /** Valor FIXO em R$ pago nesta faixa (não é percentual sobre vendas). */
  bonus: number;
}

export interface SalarioBonusAtingimentoInput {
  /** Só para exibição/auditoria (valorBase do snapshot) — NÃO entra no cálculo do bônus. */
  valorRecebido: number;
  salarioFixo: number;
  /** Ordenadas crescentes por minAtingimento, primeira faixa em 0 (garantido pelo schema de validação). */
  faixas: FaixaSalarioBonus[];
  /** Percentual de atingimento da meta, ex.: 100 = 100% (NÃO fração). */
  atingimentoPercent: number;
}

function selecionarFaixa(
  faixas: FaixaSalarioBonus[],
  atingimentoPercent: number,
): FaixaSalarioBonus {
  let faixaEscolhida = faixas[0];
  for (const faixa of faixas) {
    if (faixa.minAtingimento <= atingimentoPercent) {
      faixaEscolhida = faixa;
    }
  }
  return faixaEscolhida;
}

export function calcularSalarioBonusAtingimento(
  input: SalarioBonusAtingimentoInput,
): ComissaoResultado {
  const { valorRecebido, salarioFixo, faixas, atingimentoPercent } = input;

  const faixa = selecionarFaixa(faixas, atingimentoPercent);
  const total = arredondar(toDecimal(salarioFixo).plus(faixa.bonus));

  return {
    valorBase: valorRecebido,
    // Não é percentual sobre venda (mesmo caso de por_calls) — o extrato
    // exibe salarioFixo/bonus/total separadamente via `detalhamento`.
    percentualAplicado: null,
    valorComissao: total,
    detalhamento: {
      salarioFixo,
      bonus: faixa.bonus,
      total,
      faixaEscolhida: faixa,
      atingimentoPercent,
    },
  };
}
