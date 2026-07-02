import { CategoriaProduto } from "@prisma/client";
import { z } from "zod";

// Schemas de validação do CRUD de produto, isolados (sem "use server") pelo
// mesmo motivo de auth.schemas.ts: um arquivo "use server" só pode exportar
// funções async.
//
// Nome é texto livre (não um enum fechado): as sugestões de tier do negócio
// (START/PRO/MASTER/PADRAO/Elite) já existem hoje, mas o catálogo pode
// crescer sem exigir alteração de schema/migration.
//
// categoria (v1.1): enum fechado (ACELERACAO_MENTORIA/IMERSAO_PRESENCIAL/
// EVENTO_PRESENCIAL) — opcional no schema para não quebrar produtos
// históricos sem categoria (Fase 10), mas todo produto novo/editado por este
// formulário passa a exigi-la.
export const produtoSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  categoria: z.enum(CategoriaProduto, { message: "Categoria inválida" }),
});
