"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/server/auth/session";
import {
  criarVenda,
  atualizarVenda,
  listarVendas,
} from "@/server/services/venda.service";
import type { VendaInput } from "@/server/actions/vendas.schemas";
import type { ListarVendasFiltros } from "@/server/repositories/venda.repo";

// Server actions de venda (VENDA-01/02/04/05). Gated por
// requireRole("ADMIN") — nenhuma escrita/leitura de dados acontece antes
// dessa checagem (Pitfall 10, mesmo padrão de planos-comissao.actions.ts).
//
// As actions NÃO validam manualmente: quem valida é o service
// (criarVenda/atualizarVenda), via vendaSchema. Erros do service (venda
// fechada, validação à vista/mensalista) propagam para a UI, que mostra um
// toast de erro.

export async function criarVendaAction(input: VendaInput) {
  await requireRole("ADMIN");

  const venda = await criarVenda(input);

  revalidatePath("/vendas");

  return venda;
}

export async function atualizarVendaAction(id: string, input: VendaInput) {
  await requireRole("ADMIN");

  const venda = await atualizarVenda(id, input);

  revalidatePath("/vendas");
  revalidatePath(`/vendas/${id}`);

  return venda;
}

// Usada pela UI de busca/filtro do plano 04; a page também pode chamar o
// repo diretamente via requireRole na própria page — esta action fica
// disponível para filtros dinâmicos client-side.
export async function listarVendasAction(filtros?: ListarVendasFiltros) {
  await requireRole("ADMIN");

  return listarVendas(filtros);
}
