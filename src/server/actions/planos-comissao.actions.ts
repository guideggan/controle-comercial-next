"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/server/auth/session";
import { definirPlanoComissao } from "@/server/services/plano-comissao.service";
import { registrarAudit } from "@/server/services/audit.service";
import type { CriarPlanoComissaoInput } from "@/server/actions/planos-comissao.schemas";

// Server action de versionamento de plano de comissão (COLAB-02..06). Gated
// por requireRole("ADMIN") — nenhuma escrita acontece antes dessa checagem
// (mesmo padrão de produtos.actions.ts / colaboradores.actions.ts).
//
// A action NÃO revalida nem valida a config manualmente: quem valida
// {tipo, config} é o service (definirPlanoComissao), via
// criarPlanoComissaoSchema (discriminated union por tipo). Se o parse
// falhar, o erro propaga para a UI, que mostra um toast de erro.
//
// Auditoria (AUDIT-01) registrada após a escrita (trilha, não invariante
// transacional — mesma decisão documentada em recebimentos.actions.ts); NÃO
// duplica authz, roda depois do requireRole já feito.
export async function definirPlanoComissaoAction(
  input: CriarPlanoComissaoInput,
) {
  const user = await requireRole("ADMIN");

  const plano = await definirPlanoComissao(input);

  await registrarAudit({
    acao: "TROCAR_PLANO",
    entidade: "plano_comissao",
    entidadeId: plano.id,
    colaboradorId: input.colaboradorId,
    usuarioId: user.id,
    dadosDepois: { tipo: input.tipo, config: input.config },
  });

  revalidatePath(`/colaboradores/${input.colaboradorId}`);
  revalidatePath("/colaboradores");

  return plano;
}
