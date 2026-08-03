-- ============================================================
-- FASE 11 — plano de pagamento estruturado + espaço para Asaas/GHL
-- ============================================================
-- Migração 100% ADITIVA: nenhuma coluna existente é removida, renomeada ou
-- alterada de tipo, e toda coluna nova é nullable ou tem DEFAULT. O v1 em
-- produção continua funcionando sem nenhuma alteração de código — as vendas
-- existentes simplesmente ficam sem componentes até o backfill rodar
-- (scripts/backfill-componentes.ts).
--
-- As 4 constraints UNIQUE novas são todas sobre colunas que nascem NULL em
-- 100% das linhas existentes. No Postgres, múltiplos NULLs não colidem em um
-- índice UNIQUE, então nenhuma delas pode falhar na aplicação.

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('PIX', 'SINAL', 'CARTAO_PARCELADO', 'BOLETO', 'RECORRENCIA');

-- CreateEnum
CREATE TYPE "OrigemRegistro" AS ENUM ('MANUAL', 'GHL', 'ASAAS', 'IMPORTACAO');

-- AlterTable
ALTER TABLE "colaborador" ADD COLUMN     "ghlUserId" TEXT;

-- AlterTable
ALTER TABLE "venda" ADD COLUMN     "ghlContactId" TEXT,
ADD COLUMN     "ghlOpportunityId" TEXT,
ADD COLUMN     "origem" "OrigemRegistro" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "parcela" ADD COLUMN     "componenteId" TEXT,
ADD COLUMN     "gatewaySincronizadoEm" TIMESTAMPTZ,
ADD COLUMN     "gatewayTransactionId" TEXT,
ADD COLUMN     "origem" "OrigemRegistro" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "agendamento" ADD COLUMN     "ghlAppointmentId" TEXT,
ADD COLUMN     "ghlCalendarId" TEXT,
ADD COLUMN     "ghlContactId" TEXT,
ADD COLUMN     "origem" "OrigemRegistro" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "componente_pagamento" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "forma" "FormaPagamento" NOT NULL,
    "contaCheioNoMes" BOOLEAN NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "parcelas" INTEGER NOT NULL DEFAULT 1,
    "dataPrevista" DATE NOT NULL,
    "mesPrevisto" DATE NOT NULL,
    "descricao" TEXT,
    "gatewayChargeId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "componente_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendario_ghl" (
    "id" TEXT NOT NULL,
    "ghlCalendarId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "apuravel" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "calendario_ghl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sincronizacao_integracao" (
    "id" TEXT NOT NULL,
    "sistema" TEXT NOT NULL,
    "iniciadaEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidaEm" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
    "registrosLidos" INTEGER NOT NULL DEFAULT 0,
    "registrosConciliados" INTEGER NOT NULL DEFAULT 0,
    "divergencias" INTEGER NOT NULL DEFAULT 0,
    "relatorio" JSONB,
    "erro" TEXT,
    "executadaPor" TEXT,

    CONSTRAINT "sincronizacao_integracao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_ghlUserId_key" ON "colaborador"("ghlUserId");

-- CreateIndex
CREATE UNIQUE INDEX "venda_ghlOpportunityId_key" ON "venda"("ghlOpportunityId");

-- CreateIndex
CREATE INDEX "venda_ghlContactId_idx" ON "venda"("ghlContactId");

-- CreateIndex
CREATE UNIQUE INDEX "parcela_gatewayTransactionId_key" ON "parcela"("gatewayTransactionId");

-- CreateIndex
CREATE INDEX "parcela_componenteId_idx" ON "parcela"("componenteId");

-- CreateIndex
CREATE UNIQUE INDEX "agendamento_ghlAppointmentId_key" ON "agendamento"("ghlAppointmentId");

-- CreateIndex
CREATE INDEX "agendamento_ghlContactId_idx" ON "agendamento"("ghlContactId");

-- CreateIndex
CREATE INDEX "agendamento_ghlCalendarId_idx" ON "agendamento"("ghlCalendarId");

-- CreateIndex
CREATE UNIQUE INDEX "componente_pagamento_gatewayChargeId_key" ON "componente_pagamento"("gatewayChargeId");

-- CreateIndex
CREATE INDEX "componente_pagamento_mesPrevisto_idx" ON "componente_pagamento"("mesPrevisto");

-- CreateIndex
CREATE INDEX "componente_pagamento_vendaId_idx" ON "componente_pagamento"("vendaId");

-- CreateIndex
CREATE UNIQUE INDEX "componente_pagamento_vendaId_ordem_key" ON "componente_pagamento"("vendaId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "calendario_ghl_ghlCalendarId_key" ON "calendario_ghl"("ghlCalendarId");

-- CreateIndex
CREATE INDEX "sincronizacao_integracao_sistema_iniciadaEm_idx" ON "sincronizacao_integracao"("sistema", "iniciadaEm");

-- AddForeignKey
ALTER TABLE "componente_pagamento" ADD CONSTRAINT "componente_pagamento_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcela" ADD CONSTRAINT "parcela_componenteId_fkey" FOREIGN KEY ("componenteId") REFERENCES "componente_pagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
