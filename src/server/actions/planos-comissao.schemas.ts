import { z } from "zod";

// Schemas de validação da `config` (JSONB) dos 4 formatos de plano de
// comissão, isolados (sem "use server") pelo mesmo motivo de
// produtos.schemas.ts: um arquivo "use server" só pode exportar funções
// async. Este arquivo é a fonte única de validação da config — o motor da
// Fase 5 consome os tipos inferidos aqui, e o Postgres não valida a forma do
// JSONB (ver ARCHITECTURE.md "Why config-driven JSONB").
//
// Os 4 literais de `tipo` abaixo são os valores EXATOS do enum PlanoTipo em
// prisma/schema.prisma — mantidos como string literals (não importados de
// @prisma/client) para este arquivo continuar utilizável em qualquer camada
// sem depender do client gerado.

// Percentuais são frações (0.03 = 3%, 1 = 100%). Para o formato progressivo,
// permitimos até 5 (500%) para não travar bônus/faixas excepcionais que o
// admin queira modelar; os demais formatos usam o teto padrão de 1 (100%).
const percentualSchema = z.number().min(0).max(1);
const percentualProgressivoSchema = z.number().min(0).max(5);
// Valores em R$ nunca são negativos.
const valorSchema = z.number().min(0);

// --- Config por tipo -------------------------------------------------

export const configPercentualFixoSchema = z.object({
  percentual: percentualSchema,
});

const faixaProgressivaSchema = z.object({
  deAtingimento: z.number().min(0),
  percentual: percentualProgressivoSchema,
});

export const configProgressivoAtingimentoSchema = z
  .object({
    faixas: z.array(faixaProgressivaSchema).min(1, "Informe ao menos uma faixa"),
  })
  .refine(
    (data) =>
      data.faixas.every(
        (faixa, i) =>
          i === 0 || faixa.deAtingimento > data.faixas[i - 1].deAtingimento,
      ),
    {
      message:
        "As faixas devem estar em ordem crescente de deAtingimento, sem duplicatas",
      path: ["faixas"],
    },
  );

export const configFixoVariavelSchema = z.object({
  valorFixo: valorSchema,
  percentualVariavel: percentualSchema,
});

export const configPorCallsSchema = z.object({
  valorPorCall: valorSchema,
});

// --- Discriminated union por tipo ------------------------------------
//
// Cada campo comum (colaboradorId, vigenciaInicio) é declarado em CADA
// membro da união: `z.discriminatedUnion` no Zod v4 não aceita `.extend`
// aplicado depois de montada a união, então a forma mais simples e
// diretamente suportada é repetir os campos comuns em cada objeto membro.
const vigenciaInicioSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-01$/,
    "vigenciaInicio deve ser o primeiro dia do mês (YYYY-MM-01)",
  );
const colaboradorIdSchema = z.string().min(1, "colaboradorId é obrigatório");

export const criarPlanoComissaoSchema = z.discriminatedUnion("tipo", [
  z.object({
    colaboradorId: colaboradorIdSchema,
    vigenciaInicio: vigenciaInicioSchema,
    tipo: z.literal("percentual_fixo"),
    config: configPercentualFixoSchema,
  }),
  z.object({
    colaboradorId: colaboradorIdSchema,
    vigenciaInicio: vigenciaInicioSchema,
    tipo: z.literal("progressivo_atingimento"),
    config: configProgressivoAtingimentoSchema,
  }),
  z.object({
    colaboradorId: colaboradorIdSchema,
    vigenciaInicio: vigenciaInicioSchema,
    tipo: z.literal("fixo_variavel"),
    config: configFixoVariavelSchema,
  }),
  z.object({
    colaboradorId: colaboradorIdSchema,
    vigenciaInicio: vigenciaInicioSchema,
    tipo: z.literal("por_calls"),
    config: configPorCallsSchema,
  }),
]);

// Union isolada de {tipo, config} (sem os campos comuns), útil para validar
// apenas a config de um plano já existente (ex.: ao ler do banco no motor da
// Fase 5), sem exigir colaboradorId/vigenciaInicio.
export const planoConfigSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("percentual_fixo"), config: configPercentualFixoSchema }),
  z.object({
    tipo: z.literal("progressivo_atingimento"),
    config: configProgressivoAtingimentoSchema,
  }),
  z.object({ tipo: z.literal("fixo_variavel"), config: configFixoVariavelSchema }),
  z.object({ tipo: z.literal("por_calls"), config: configPorCallsSchema }),
]);

export type PlanoConfig = z.infer<typeof planoConfigSchema>;
export type CriarPlanoComissaoInput = z.infer<typeof criarPlanoComissaoSchema>;
