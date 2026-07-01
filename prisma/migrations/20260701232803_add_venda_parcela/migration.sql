-- CreateEnum
CREATE TYPE "Plataforma" AS ENUM ('ASAAS', 'PAGARME', 'INTER', 'GURU', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoPagamento" AS ENUM ('A_VISTA', 'MENSALISTA');

-- CreateEnum
CREATE TYPE "ParcelaTipo" AS ENUM ('ENTRADA', 'MENSALIDADE', 'AVISTA');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'PAGO');

-- CreateTable
CREATE TABLE "venda" (
    "id" TEXT NOT NULL,
    "dataVenda" DATE NOT NULL,
    "alunoNome" TEXT NOT NULL,
    "pagadorNome" TEXT NOT NULL,
    "plataforma" "Plataforma" NOT NULL,
    "produtoId" TEXT NOT NULL,
    "tipoPagamento" "TipoPagamento" NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "entrada" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valorMensalidade" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "numeroParcelas" INTEGER NOT NULL DEFAULT 1,
    "diaVencimento" INTEGER NOT NULL,
    "mesReferencia" DATE NOT NULL,
    "closerId" TEXT NOT NULL,
    "sdrId" TEXT,
    "observacao" TEXT,
    "fechado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcela" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "tipo" "ParcelaTipo" NOT NULL,
    "numero" INTEGER NOT NULL,
    "mesReferencia" DATE NOT NULL,
    "dataVencimento" DATE NOT NULL,
    "valorPrevisto" DECIMAL(14,2) NOT NULL,
    "statusPagamento" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "valorRecebido" DECIMAL(14,2),
    "dataPagamento" DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "parcela_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venda_closerId_idx" ON "venda"("closerId");

-- CreateIndex
CREATE INDEX "venda_sdrId_idx" ON "venda"("sdrId");

-- CreateIndex
CREATE INDEX "venda_mesReferencia_idx" ON "venda"("mesReferencia");

-- CreateIndex
CREATE INDEX "parcela_mesReferencia_idx" ON "parcela"("mesReferencia");

-- CreateIndex
CREATE INDEX "parcela_statusPagamento_idx" ON "parcela"("statusPagamento");

-- CreateIndex
CREATE UNIQUE INDEX "parcela_vendaId_tipo_numero_key" ON "parcela"("vendaId", "tipo", "numero");

-- AddForeignKey
ALTER TABLE "venda" ADD CONSTRAINT "venda_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venda" ADD CONSTRAINT "venda_closerId_fkey" FOREIGN KEY ("closerId") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venda" ADD CONSTRAINT "venda_sdrId_fkey" FOREIGN KEY ("sdrId") REFERENCES "colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcela" ADD CONSTRAINT "parcela_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
