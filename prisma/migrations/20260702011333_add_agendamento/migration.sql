-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('AGENDADO', 'REALIZADO', 'NO_SHOW', 'CANCELADO');

-- CreateTable
CREATE TABLE "agendamento" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "status" "StatusAgendamento" NOT NULL DEFAULT 'AGENDADO',
    "observacao" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agendamento_colaboradorId_data_idx" ON "agendamento"("colaboradorId", "data");

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
