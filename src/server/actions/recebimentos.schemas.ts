import { z } from "zod";

// Schema de validação de marcar-parcela-paga, isolado (sem "use server")
// pelo mesmo motivo de vendas.schemas.ts: um arquivo "use server" só pode
// exportar funções async. Fonte única de validação do diálogo de
// marcar-pago (plano 04-03).
//
// Dinheiro trafega como number puro (nunca formatado). Data trafega como
// string "YYYY-MM-DD" (Pitfall 6): nunca fazemos round-trip por
// `new Date(string)` ciente de timezone local — a conversão para `Date`
// UTC acontece na borda do repo (paraDataUTC).

export const marcarParcelaPagaSchema = z.object({
  valorRecebido: z
    .number()
    .min(0, "Valor recebido não pode ser negativo"),
  dataPagamento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
});

export type MarcarParcelaPagaInput = z.infer<typeof marcarParcelaPagaSchema>;
