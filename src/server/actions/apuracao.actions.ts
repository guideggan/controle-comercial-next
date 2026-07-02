"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/server/auth/session";
import {
  apurarMes,
  fecharApuracao,
  reabrirApuracao,
  definirObservacaoApuracao,
} from "@/server/services/apuracao.service";

// Server actions de apuração (COMIS-04/05/06). Gated por requireRole("ADMIN")
// PRIMEIRO — nenhuma leitura/escrita antes dessa checagem (Pitfall 10, mesmo
// padrão de recebimentos.actions.ts/planos-comissao.actions.ts).

export async function apurarMesAction(mesReferencia: string) {
  const user = await requireRole("ADMIN");

  const resultado = await apurarMes(mesReferencia, { calculadoPor: user.id });

  revalidatePath("/comissoes");

  return resultado;
}

export async function fecharApuracaoAction(mesReferencia: string) {
  const user = await requireRole("ADMIN");

  const resultado = await fecharApuracao(mesReferencia, user.id);

  // venda.fechado muda ao fechar o mês — revalida também a listagem de
  // vendas (mesmo espírito de recebimentos.actions.ts).
  revalidatePath("/comissoes");
  revalidatePath("/vendas");

  return resultado;
}

export async function reabrirApuracaoAction(mesReferencia: string) {
  const user = await requireRole("ADMIN");

  const resultado = await reabrirApuracao(mesReferencia, user.id);

  revalidatePath("/comissoes");
  revalidatePath("/vendas");

  return resultado;
}

// Observação livre por pessoa/mês (v1.1) — editável no fechamento, mesmo com
// o mês já FECHADO (é anotação, não recálculo).
export async function definirObservacaoApuracaoAction(
  colaboradorId: string,
  mesReferencia: string,
  observacao: string | null,
) {
  const user = await requireRole("ADMIN");

  const resultado = await definirObservacaoApuracao(
    colaboradorId,
    mesReferencia,
    observacao,
    user.id,
  );

  revalidatePath("/comissoes");

  return resultado;
}
