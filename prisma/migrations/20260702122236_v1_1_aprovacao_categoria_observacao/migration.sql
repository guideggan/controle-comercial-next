-- CreateEnum
CREATE TYPE "CategoriaProduto" AS ENUM ('ACELERACAO_MENTORIA', 'IMERSAO_PRESENCIAL', 'EVENTO_PRESENCIAL');

-- CreateEnum
CREATE TYPE "StatusAprovacao" AS ENUM ('PENDENTE_APROVACAO', 'APROVADA', 'REJEITADA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AcaoAudit" ADD VALUE 'APROVAR_VENDA';
ALTER TYPE "AcaoAudit" ADD VALUE 'REJEITAR_VENDA';
ALTER TYPE "AcaoAudit" ADD VALUE 'ARQUIVAR_COLABORADOR';
ALTER TYPE "AcaoAudit" ADD VALUE 'EXCLUIR_COLABORADOR';

-- AlterTable
ALTER TABLE "comissao_apurada" ADD COLUMN     "observacao" TEXT;

-- AlterTable
ALTER TABLE "produto" ADD COLUMN     "categoria" "CategoriaProduto";

-- AlterTable
ALTER TABLE "venda" ADD COLUMN     "aprovadaEm" TIMESTAMPTZ,
ADD COLUMN     "aprovadaPorId" TEXT,
ADD COLUMN     "criadaPorId" TEXT,
ADD COLUMN     "linkCrm" TEXT,
ADD COLUMN     "statusAprovacao" "StatusAprovacao" NOT NULL DEFAULT 'APROVADA';

-- CreateIndex
CREATE INDEX "venda_statusAprovacao_idx" ON "venda"("statusAprovacao");

-- AddForeignKey
ALTER TABLE "venda" ADD CONSTRAINT "venda_aprovadaPorId_fkey" FOREIGN KEY ("aprovadaPorId") REFERENCES "colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venda" ADD CONSTRAINT "venda_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;
