import { z } from "zod";

// Schema de validação de agendamento (AGEND-01), isolado (sem "use server")
// pelo mesmo motivo de vendas.schemas.ts/recebimentos.schemas.ts: um
// arquivo "use server" só pode exportar funções async.
//
// Os literais de `status` abaixo são os valores EXATOS do enum
// StatusAgendamento em prisma/schema.prisma, mantidos como string literals
// (não importados de @prisma/client) para este arquivo continuar
// utilizável em qualquer camada sem depender do client gerado.

const dataSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD");

export const statusAgendamentoSchema = z.enum([
  "AGENDADO",
  "REALIZADO",
  "NO_SHOW",
  "CANCELADO",
]);

// colaboradorId NÃO faz parte deste schema de input do formulário — o dono
// do agendamento é sempre resolvido no server (sessão ou, para ADMIN,
// parâmetro explícito checado por requireSelfOrAdmin), nunca confiado a
// partir do client (Pitfall 1/IDOR).
export const criarAgendamentoSchema = z.object({
  data: dataSchema,
  status: statusAgendamentoSchema.default("AGENDADO"),
  observacao: z.string().trim().optional(),
});

export type CriarAgendamentoInput = z.infer<typeof criarAgendamentoSchema>;

export const atualizarStatusAgendamentoSchema = z.object({
  status: statusAgendamentoSchema,
});

export type AtualizarStatusAgendamentoInput = z.infer<
  typeof atualizarStatusAgendamentoSchema
>;
