import { z } from "zod";

import {
  contaCheioPorPadrao,
  validarEntradaMinima,
  type ComponentePagamento,
  type FormaPagamento,
} from "@/domain/vendas/componentes";

// Schema de validação dos componentes do plano de pagamento (Fase 11 /
// PGMT-01, PGMT-05). Isolado sem "use server" pelo mesmo motivo dos demais
// *.schemas.ts: um arquivo "use server" só pode exportar funções async.
//
// Dinheiro trafega como number puro; datas como string "YYYY-MM-DD"
// (Pitfall 6) — mesma convenção de vendas.schemas.ts.

const dataSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD");

export const FORMAS_PAGAMENTO = [
  "PIX",
  "SINAL",
  "CARTAO_PARCELADO",
  "BOLETO",
  "RECORRENCIA",
] as const satisfies readonly FormaPagamento[];

/** Rótulos para a UI. Ficam aqui (e não num arquivo de UI) para que o
 * formulário, o detalhe da venda e o export CSV usem exatamente os mesmos
 * termos — o vocabulário da regra de negócio é único. */
export const ROTULO_FORMA: Record<FormaPagamento, string> = {
  PIX: "PIX",
  SINAL: "Sinal",
  CARTAO_PARCELADO: "Cartão parcelado",
  BOLETO: "Boleto",
  RECORRENCIA: "Recorrência (assinatura)",
};

/** Explicação de por que a forma conta cheio ou não — texto voltado ao
 * usuário, para o formulário não parecer arbitrário. */
export const EXPLICACAO_FORMA: Record<FormaPagamento, string> = {
  PIX: "O dinheiro já caiu. Conta cheio no mês.",
  SINAL: "O dinheiro já caiu. Conta cheio no mês.",
  CARTAO_PARCELADO:
    "A operadora aprovou a compra inteira de uma vez — o cliente não cancela o que falta. Conta cheio no mês.",
  BOLETO:
    "O cliente pode não pagar o próximo boleto. Conta conforme cada boleto é pago.",
  RECORRENCIA:
    "O cliente pode cancelar a assinatura quando quiser. Conta conforme cada parcela é paga.",
};

export const componenteSchema = z.object({
  forma: z.enum(FORMAS_PAGAMENTO),
  /** Opcional na entrada: quando omitido, é derivado da forma
   * (CONTA_CHEIO_POR_PADRAO). Só precisa ser informado no caso raro que foge
   * do padrão. */
  contaCheioNoMes: z.boolean().optional(),
  valor: z.number().positive("O valor do componente precisa ser maior que zero"),
  parcelas: z
    .number()
    .int("Número de parcelas deve ser inteiro")
    .min(1, "Número de parcelas deve ser ao menos 1")
    .max(120, "Número de parcelas parece incorreto (máximo 120)")
    .default(1),
  dataPrevista: dataSchema,
  descricao: z.string().trim().max(500).optional().nullable(),
});

export type ComponenteInput = z.infer<typeof componenteSchema>;

/** Resolve o `contaCheioNoMes` efetivo: o que veio no input, ou o default da
 * forma. Ponto ÚNICO dessa decisão em toda a camada de aplicação — nenhum
 * service/repo deve repetir esse `??`. */
export function resolverComponente(input: ComponenteInput): ComponentePagamento {
  return {
    forma: input.forma,
    contaCheioNoMes: input.contaCheioNoMes ?? contaCheioPorPadrao(input.forma),
    valor: input.valor,
    parcelas: input.parcelas,
    dataPrevista: input.dataPrevista,
    descricao: input.descricao ?? null,
  };
}

export function resolverComponentes(
  inputs: ComponenteInput[],
): ComponentePagamento[] {
  return inputs.map(resolverComponente);
}

/**
 * Lista de componentes de uma venda NOVA: ao menos um, e sujeita à política
 * de 50% de entrada mínima (PGMT-05).
 *
 * A validação de 50% NÃO está no `componenteSchema` individual porque é uma
 * regra sobre o CONJUNTO — o Cliente A tem dois componentes de 72k, nenhum dos
 * quais é "50% de nada" sozinho, mas juntos são 100% de entrada.
 *
 * NÃO usar este schema para histórico/backfill: vendas anteriores à política
 * (ex.: 100% recorrência, em julho/2026) existem no banco e
 * precisam continuar existindo (PGMT-07).
 */
export const componentesDeVendaNovaSchema = z
  .array(componenteSchema)
  .min(1, "A venda precisa de ao menos um componente de pagamento")
  .max(20, "Número de componentes parece incorreto (máximo 20)")
  .check((ctx) => {
    const resultado = validarEntradaMinima(resolverComponentes(ctx.value));
    if (!resultado.valido) {
      ctx.issues.push({
        code: "custom",
        message: resultado.motivo,
        path: [],
        input: ctx.value,
      });
    }
  });

/** Variante sem a trava de 50%, para conversão de histórico e correção
 * administrativa de vendas antigas. Sempre explícita no ponto de uso — nunca
 * é o default. */
export const componentesHistoricosSchema = z
  .array(componenteSchema)
  .min(1, "A venda precisa de ao menos um componente de pagamento")
  .max(20);
