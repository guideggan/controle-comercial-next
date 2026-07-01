"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/server/auth/session";
import { definirPlanoComissao } from "@/server/services/plano-comissao.service";
import type { CriarPlanoComissaoInput } from "@/server/actions/planos-comissao.schemas";

// Server action de versionamento de plano de comissão (COLAB-02..06). Gated
// por requireRole("ADMIN") — nenhuma escrita acontece antes dessa checagem
// (mesmo padrão de produtos.actions.ts / colaboradores.actions.ts).
//
// A action NÃO revalida nem valida a config manualmente: quem valida
// {tipo, config} é o service (definirPlanoComissao), via
// criarPlanoComissaoSchema (discriminated union por tipo). Se o parse
// falhar, o erro propaga para a UI, que mostra um toast de erro.
export async function definirPlanoComissaoAction(
  input: CriarPlanoComissaoInput,
) {
  await requireRole("ADMIN");

  const plano = await definirPlanoComissao(input);

  revalidatePath(`/colaboradores/${input.colaboradorId}`);
  revalidatePath("/colaboradores");

  return plano;
}
