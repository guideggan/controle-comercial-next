import "server-only";

import type { AcaoAudit, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

// Repositório de acesso a dados de AuditLog (AUDIT-01) — inserção pura, sem
// authz. A decisão de O QUE logar (nunca PII bruta) vive em audit.service.ts.

type AuditLogClient = Pick<typeof db, "auditLog">;

export type CriarAuditLogData = {
  acao: AcaoAudit;
  entidade: string;
  entidadeId: string;
  colaboradorId?: string | null;
  usuarioId?: string | null;
  dadosAntes?: Prisma.InputJsonValue;
  dadosDepois?: Prisma.InputJsonValue;
};

// Aceita `tx` opcional (mesmo padrão dos demais repos): quando chamada
// dentro de um db.$transaction, a linha de auditoria é gravada atomicamente
// junto com a mudança que ela descreve.
export function criarAuditLog(
  tx: AuditLogClient | undefined,
  dados: CriarAuditLogData,
) {
  const client = tx ?? db;
  return client.auditLog.create({
    data: {
      acao: dados.acao,
      entidade: dados.entidade,
      entidadeId: dados.entidadeId,
      colaboradorId: dados.colaboradorId ?? null,
      usuarioId: dados.usuarioId ?? null,
      dadosAntes: dados.dadosAntes,
      dadosDepois: dados.dadosDepois,
    },
  });
}
