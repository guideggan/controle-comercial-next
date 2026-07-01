import "server-only";

import { db } from "@/lib/db";

// Repositório de acesso a dados de Produto — funções puras, sem authz.
// A autorização (requireRole("ADMIN")) vive nas Server Actions que chamam
// estas funções (src/server/actions/produtos.actions.ts), nunca aqui.

export type CriarProdutoData = {
  nome: string;
};

export type AtualizarProdutoData = {
  nome: string;
};

export function listarProdutos() {
  return db.produto.findMany({
    orderBy: { nome: "asc" },
  });
}

export function criarProdutoRow(data: CriarProdutoData) {
  return db.produto.create({
    data: {
      nome: data.nome,
    },
  });
}

export function atualizarProdutoRow(id: string, data: AtualizarProdutoData) {
  return db.produto.update({
    where: { id },
    data: {
      nome: data.nome,
    },
  });
}

export function setProdutoAtivo(id: string, ativo: boolean) {
  return db.produto.update({
    where: { id },
    data: { ativo },
  });
}
