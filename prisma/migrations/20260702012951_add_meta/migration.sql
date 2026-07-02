-- CreateEnum
CREATE TYPE "MetaUnidade" AS ENUM ('VALOR', 'AGENDAMENTOS');

-- CreateTable
CREATE TABLE "meta" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "mesReferencia" DATE NOT NULL,
    "unidade" "MetaUnidade" NOT NULL,
    "valorMeta" DECIMAL(14,2),
    "metaAgendamentos" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "meta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meta_mesReferencia_idx" ON "meta"("mesReferencia");

-- CreateIndex
CREATE UNIQUE INDEX "meta_colaboradorId_mesReferencia_key" ON "meta"("colaboradorId", "mesReferencia");

-- AddForeignKey
ALTER TABLE "meta" ADD CONSTRAINT "meta_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint (raw SQL — Prisma não valida XOR nativamente no schema):
-- valorMeta e metaAgendamentos são mutuamente exclusivos, de acordo com
-- `unidade` (VALOR usa valorMeta; AGENDAMENTOS usa metaAgendamentos) —
-- mesmo padrão XOR documentado em ARCHITECTURE.md para a tabela `meta`.
ALTER TABLE "meta" ADD CONSTRAINT "meta_valor_xor_agendamentos" CHECK (
    ("unidade" = 'VALOR' AND "valorMeta" IS NOT NULL AND "metaAgendamentos" IS NULL) OR
    ("unidade" = 'AGENDAMENTOS' AND "metaAgendamentos" IS NOT NULL AND "valorMeta" IS NULL)
);
