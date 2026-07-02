import { z } from "zod";

// Schema de validação de meta (META-01), isolado (sem "use server") pelo
// mesmo motivo de agendamentos.schemas.ts: um arquivo "use server" só pode
// exportar funções async.
//
// A UNIDADE não é escolhida livremente pelo formulário — o service resolve
// a partir do papel do colaborador (CLOSER -> VALOR, SDR/SS -> AGENDAMENTOS)
// e valida que o campo correspondente foi preenchido. O client sempre manda
// os dois campos como opcionais; o service decide qual usar.

const mesReferenciaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-01$/, "mesReferencia deve estar no formato YYYY-MM-01");

export const definirMetaSchema = z.object({
  mesReferencia: mesReferenciaSchema,
  valorMeta: z.number().min(0, "Meta não pode ser negativa").optional(),
  metaAgendamentos: z
    .number()
    .int("Meta de agendamentos deve ser um número inteiro")
    .min(0, "Meta não pode ser negativa")
    .optional(),
});

export type DefinirMetaInput = z.infer<typeof definirMetaSchema>;
