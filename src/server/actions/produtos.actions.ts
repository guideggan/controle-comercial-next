"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/server/auth/session";
import {
  atualizarProdutoRow,
  criarProdutoRow,
  setProdutoAtivo,
} from "@/server/repositories/produto.repo";
import { produtoSchema } from "@/server/actions/produtos.schemas";

// Server actions do CRUD de Produto/tier (COLAB-07). Cada action começa com
// requireRole("ADMIN") — nenhuma escrita acontece antes dessa checagem.

export async function criarProduto(input: { nome: string; categoria: string }) {
  await requireRole("ADMIN");

  const parsed = produtoSchema.parse(input);
  await criarProdutoRow(parsed);

  revalidatePath("/produtos");
}

export async function atualizarProduto(
  id: string,
  input: { nome: string; categoria: string },
) {
  await requireRole("ADMIN");

  const parsed = produtoSchema.parse(input);
  await atualizarProdutoRow(id, parsed);

  revalidatePath("/produtos");
}

export async function alternarProdutoAtivo(id: string, ativo: boolean) {
  await requireRole("ADMIN");

  await setProdutoAtivo(id, ativo);

  revalidatePath("/produtos");
}
