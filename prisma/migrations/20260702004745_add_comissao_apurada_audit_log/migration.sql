-- CreateEnum
CREATE TYPE "StatusApuracao" AS ENUM ('ABERTA', 'FECHADA');

-- CreateEnum
CREATE TYPE "AcaoAudit" AS ENUM ('MARCAR_PAGO', 'REVERTER_PAGO', 'EDITAR_VENDA', 'TROCAR_PLANO', 'FECHAR_APURACAO', 'REABRIR_APURACAO', 'APURAR_COMISSAO');

-- CreateTable
CREATE TABLE "comissao_apurada" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "mesReferencia" DATE NOT NULL,
    "mesPagamento" DATE NOT NULL,
    "planoComissaoId" TEXT NOT NULL,
    "tipoPlano" "PlanoTipo" NOT NULL,
    "valorBase" DECIMAL(14,2) NOT NULL,
    "percentualAplicado" DECIMAL(6,4),
    "valorComissao" DECIMAL(14,2) NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "status" "StatusApuracao" NOT NULL DEFAULT 'ABERTA',
    "calculadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculadoPor" TEXT,
    "fechadoEm" TIMESTAMPTZ,
    "fechadoPor" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "comissao_apurada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "acao" "AcaoAudit" NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "colaboradorId" TEXT,
    "usuarioId" TEXT,
    "dadosAntes" JSONB,
    "dadosDepois" JSONB,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comissao_apurada_mesPagamento_idx" ON "comissao_apurada"("mesPagamento");

-- CreateIndex
CREATE INDEX "comissao_apurada_mesReferencia_idx" ON "comissao_apurada"("mesReferencia");

-- CreateIndex
CREATE UNIQUE INDEX "comissao_apurada_colaboradorId_mesReferencia_key" ON "comissao_apurada"("colaboradorId", "mesReferencia");

-- CreateIndex
CREATE INDEX "audit_log_entidade_entidadeId_idx" ON "audit_log"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "audit_log_colaboradorId_idx" ON "audit_log"("colaboradorId");

-- CreateIndex
CREATE INDEX "audit_log_criadoEm_idx" ON "audit_log"("criadoEm");

-- AddForeignKey
ALTER TABLE "comissao_apurada" ADD CONSTRAINT "comissao_apurada_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissao_apurada" ADD CONSTRAINT "comissao_apurada_planoComissaoId_fkey" FOREIGN KEY ("planoComissaoId") REFERENCES "plano_comissao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
