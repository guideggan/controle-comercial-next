-- CreateEnum
CREATE TYPE "PlanoTipo" AS ENUM ('percentual_fixo', 'progressivo_atingimento', 'fixo_variavel', 'por_calls');

-- CreateTable
CREATE TABLE "plano_comissao" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "tipo" "PlanoTipo" NOT NULL,
    "config" JSONB NOT NULL,
    "vigenciaInicio" DATE NOT NULL,
    "vigenciaFim" DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plano_comissao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plano_comissao_colaboradorId_idx" ON "plano_comissao"("colaboradorId");

-- AddForeignKey
ALTER TABLE "plano_comissao" ADD CONSTRAINT "plano_comissao_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex (raw SQL — Prisma não suporta índice único parcial no schema)
-- Garante que só existe UM plano de comissão com vigência aberta
-- (vigenciaFim IS NULL) por colaborador. Uma troca de plano deve sempre
-- fechar a linha anterior (SET "vigenciaFim") antes de inserir a nova.
CREATE UNIQUE INDEX "plano_comissao_vigente_uq" ON "plano_comissao" ("colaboradorId") WHERE "vigenciaFim" IS NULL;

-- CheckConstraint: quando a vigência é fechada, o fim precisa ser
-- estritamente posterior ao início (nunca um período invertido/vazio).
ALTER TABLE "plano_comissao" ADD CONSTRAINT "plano_comissao_periodo_valido" CHECK ("vigenciaFim" IS NULL OR "vigenciaFim" > "vigenciaInicio");
