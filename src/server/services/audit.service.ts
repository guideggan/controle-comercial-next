import "server-only";

import type { AcaoAudit, Prisma } from "@prisma/client";

import { criarAuditLog } from "@/server/repositories/audit-log.repo";
import { db } from "@/lib/db";

// Fachada fina da trilha de auditoria (AUDIT-01). LGPD/log hygiene: NUNCA
// logar PII bruta (CPF, nome completo do pagador, etc.) em dadosAntes/Depois
// — apenas campos relevantes para "por que meu número mudou" (valores,
// status, ids). Cada chamador decide o shape exato do payload; este serviço
// só delega ao repo, aceitando `tx` opcional para gravar a auditoria dentro
// da mesma transação da mudança que ela descreve.

export type RegistrarAuditInput = {
  acao: AcaoAudit;
  entidade: string;
  entidadeId: string;
  colaboradorId?: string | null;
  usuarioId?: string | null;
  dadosAntes?: Prisma.InputJsonValue;
  dadosDepois?: Prisma.InputJsonValue;
  tx?: Pick<typeof db, "auditLog">;
};

export function registrarAudit(input: RegistrarAuditInput) {
  const { tx, ...dados } = input;
  return criarAuditLog(tx, dados);
}
