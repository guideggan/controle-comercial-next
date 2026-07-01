import "server-only";

import type { Papel } from "@prisma/client";

import { db } from "@/lib/db";

// Repositório de acesso a dados de Colaborador — funções puras, sem authz.
// A autorização (requireRole("ADMIN")) vive nas Server Actions que chamam
// estas funções (src/server/actions/colaboradores.actions.ts), nunca aqui.

export type CriarColaboradorRowData = {
  nome: string;
  email: string;
  papel: Papel;
  telefone?: string;
  pix?: string;
};

export function listarColaboradores() {
  return db.colaborador.findMany({
    orderBy: { nome: "asc" },
    include: { user: { select: { id: true } } },
  });
}

export function getColaborador(id: string) {
  return db.colaborador.findUnique({
    where: { id },
    include: { user: { select: { id: true } } },
  });
}

export function criarColaboradorRow(
  tx: Pick<typeof db, "colaborador">,
  data: CriarColaboradorRowData,
) {
  return tx.colaborador.create({
    data: {
      nome: data.nome,
      email: data.email,
      papel: data.papel,
      telefone: data.telefone,
      pix: data.pix,
    },
  });
}

export function setColaboradorAtivo(id: string, ativo: boolean) {
  return db.colaborador.update({
    where: { id },
    data: { ativo },
  });
}

export type AtualizarColaboradorRowData = {
  nome: string;
  papel: Papel;
  telefone?: string;
  pix?: string;
};

export function atualizarColaboradorRow(
  id: string,
  data: AtualizarColaboradorRowData,
) {
  return db.colaborador.update({
    where: { id },
    data: {
      nome: data.nome,
      papel: data.papel,
      telefone: data.telefone,
      pix: data.pix,
    },
  });
}
