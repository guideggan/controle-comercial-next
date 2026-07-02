"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/server/auth/session";
import {
  apurarMes,
  fecharApuracao,
  reabrirApuracao,
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
