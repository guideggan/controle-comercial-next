"use server";

import { revalidatePath } from "next/cache";

import { requireRole, requireUser } from "@/server/auth/session";
import {
  criarVenda,
  atualizarVenda,
  listarVendas,
  listarVendasPendentesAprovacao,
  aprovarVenda,
  rejeitarVenda,
} from "@/server/services/venda.service";
import type { VendaInput } from "@/server/actions/vendas.schemas";
import type { ListarVendasFiltros } from "@/server/repositories/venda.repo";

// Server actions de venda (VENDA-01/02/04/05/11/12). Gated por requireRole —
// nenhuma escrita/leitura de dados acontece antes dessa checagem (Pitfall
// 10, mesmo padrão de planos-comissao.actions.ts).
//
// As actions NÃO validam manualmente: quem valida é o service
// (criarVenda/atualizarVenda), via vendaSchema. Erros do service (venda
// fechada, validação à vista/mensalista, linkCrm ausente) propagam para a
// UI, que mostra um toast de erro.

// v1.1 (VENDA-11): ADMIN e CLOSER podem criar venda — a diferença de
// comportamento (APROVADA vs PENDENTE_APROVACAO, linkCrm obrigatório) é
// inteiramente decidida pelo service a partir do `criador` real da sessão
// (nunca aceito do client, Pitfall 1/IDOR). SDR/SS continuam sem acesso.
export async function criarVendaAction(input: VendaInput) {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "CLOSER") {
    throw new Error("Forbidden: apenas ADMIN ou CLOSER podem cadastrar venda");
  }

  const venda = await criarVenda(input, {
    role: user.role,
    colaboradorId: user.colaboradorId,
  });

  revalidatePath("/vendas");
  revalidatePath("/vendas/pendentes");

  return venda;
}

// Fila de aprovação (VENDA-11) — só ADMIN vê/decide.
export async function listarVendasPendentesAprovacaoAction() {
  await requireRole("ADMIN");

  return listarVendasPendentesAprovacao();
}

export async function aprovarVendaAction(id: string) {
  const user = await requireRole("ADMIN");

  const venda = await aprovarVenda(id, user.colaboradorId);

  revalidatePath("/vendas");
  revalidatePath("/vendas/pendentes");
  revalidatePath(`/vendas/${id}`);

  return venda;
}

export async function rejeitarVendaAction(id: string) {
  const user = await requireRole("ADMIN");

  const venda = await rejeitarVenda(id, user.colaboradorId);

  revalidatePath("/vendas");
  revalidatePath("/vendas/pendentes");
  revalidatePath(`/vendas/${id}`);

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
