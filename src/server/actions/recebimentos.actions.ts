"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/server/auth/session";
import {
  marcarParcelaPaga,
  reverterParcelaPendente,
} from "@/server/services/recebimento.service";
import type { MarcarParcelaPagaInput } from "@/server/actions/recebimentos.schemas";

// Server actions de recebimento (PGTO-01). Gated por requireRole("ADMIN")
// — nenhuma escrita/leitura de dados acontece antes dessa checagem
// (Pitfall 10, mesmo padrão de vendas.actions.ts).
//
// As actions NÃO validam manualmente: quem valida é o service
// (marcarParcelaPaga), via marcarParcelaPagaSchema. Erros do service
// (parcela não encontrada, venda fechada) propagam para a UI, que mostra
// um toast de erro.

export async function marcarParcelaPagaAction(
  parcelaId: string,
  input: MarcarParcelaPagaInput,
) {
  await requireRole("ADMIN");

  const parcela = await marcarParcelaPaga(parcelaId, input);

  // Revalida a listagem de vendas de forma ampla — a página de detalhe da
  // venda é revalidada pelo router.refresh() do client, mesmo padrão já
  // usado nos forms de venda (vendas.actions.ts).
  revalidatePath("/vendas");

  return parcela;
}

export async function reverterParcelaPendenteAction(parcelaId: string) {
  await requireRole("ADMIN");

  const parcela = await reverterParcelaPendente(parcelaId);

  revalidatePath("/vendas");

  return parcela;
}
