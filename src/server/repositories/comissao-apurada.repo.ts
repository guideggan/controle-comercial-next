import "server-only";

import type { Prisma, PlanoTipo } from "@prisma/client";

import { db } from "@/lib/db";

// Repositório de acesso a dados de ComissaoApurada (Fase 5) — funções puras,
// sem authz (mesmo padrão de plano-comissao.repo.ts). A orquestração
// (guard de mês fechado, transação) vive no service (apuracao.service.ts).

type ComissaoApuradaClient = Pick<typeof db, "comissaoApurada">;

// Converte "YYYY-MM-DD"/"YYYY-MM-01" em Date UTC puro. Mesmo bug documentado
// em venda.repo.ts/plano-comissao.repo.ts: o Prisma Client 6.19.x rejeita
// strings cruas em colunas @db.Date (Pitfall 6).
function paraDataUTC(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

export type UpsertApuracaoData = {
  colaboradorId: string;
  mesReferencia: string; // "YYYY-MM-01"
  mesPagamento: string; // "YYYY-MM-01"
  planoComissaoId: string;
  tipoPlano: PlanoTipo;
  valorBase: number;
  percentualAplicado: number | null;
  valorComissao: number;
  inputSnapshot: Prisma.InputJsonValue;
  calculadoPor?: string | null;
};

// Upsert por (colaboradorId, mesReferencia) — recomputa a linha ABERTA
// livremente; o guard de "mês FECHADO recusa escrita" vive no service, ANTES
// desta chamada (COMIS-06).
export function upsertApuracao(
  tx: ComissaoApuradaClient,
  dados: UpsertApuracaoData,
) {
  const mesReferenciaData = paraDataUTC(dados.mesReferencia);

  return tx.comissaoApurada.upsert({
    where: {
      colaboradorId_mesReferencia: {
        colaboradorId: dados.colaboradorId,
        mesReferencia: mesReferenciaData,
      },
    },
    create: {
      colaboradorId: dados.colaboradorId,
      mesReferencia: mesReferenciaData,
      mesPagamento: paraDataUTC(dados.mesPagamento),
      planoComissaoId: dados.planoComissaoId,
      tipoPlano: dados.tipoPlano,
      valorBase: dados.valorBase,
      percentualAplicado: dados.percentualAplicado,
      valorComissao: dados.valorComissao,
      inputSnapshot: dados.inputSnapshot,
      calculadoEm: new Date(),
      calculadoPor: dados.calculadoPor ?? null,
    },
    update: {
      mesPagamento: paraDataUTC(dados.mesPagamento),
      planoComissaoId: dados.planoComissaoId,
      tipoPlano: dados.tipoPlano,
      valorBase: dados.valorBase,
      percentualAplicado: dados.percentualAplicado,
      valorComissao: dados.valorComissao,
      inputSnapshot: dados.inputSnapshot,
      calculadoEm: new Date(),
      calculadoPor: dados.calculadoPor ?? null,
    },
  });
}

export function getApuracao(colaboradorId: string, mesReferencia: string) {
  return db.comissaoApurada.findUnique({
    where: {
      colaboradorId_mesReferencia: {
        colaboradorId,
        mesReferencia: paraDataUTC(mesReferencia),
      },
    },
  });
}

// Todas as linhas de uma competência, com o colaborador incluso — consumido
// pela UI de apuração (05-04) para montar a tabela por pessoa.
export function listarApuracoesDoMes(mesReferencia: string) {
  return db.comissaoApurada.findMany({
    where: { mesReferencia: paraDataUTC(mesReferencia) },
    include: { colaborador: true },
    orderBy: { colaborador: { nome: "asc" } },
  });
}

// Trava/destrava o mês inteiro. Recebe `tx` para compor na mesma transação
// de fecharApuracao/reabrirApuracao (que também atualiza venda.fechado).
export function fecharMes(
  tx: ComissaoApuradaClient,
  mesReferencia: string,
  fechadoPor?: string | null,
) {
  return tx.comissaoApurada.updateMany({
    where: { mesReferencia: paraDataUTC(mesReferencia) },
    data: {
      status: "FECHADA",
      fechadoEm: new Date(),
      fechadoPor: fechadoPor ?? null,
    },
  });
}

export function reabrirMes(tx: ComissaoApuradaClient, mesReferencia: string) {
  return tx.comissaoApurada.updateMany({
    where: { mesReferencia: paraDataUTC(mesReferencia) },
    data: {
      status: "ABERTA",
      fechadoEm: null,
      fechadoPor: null,
    },
  });
}

// Grava a observação livre por pessoa/mês (v1.1) — coluna independente do
// resultado calculado (não passa pelo motor, não afeta valorComissao). Update
// simples (não upsert): só faz sentido anotar uma apuração que já existe.
export function definirObservacaoApuracaoRow(
  colaboradorId: string,
  mesReferencia: string,
  observacao: string | null,
) {
  return db.comissaoApurada.update({
    where: {
      colaboradorId_mesReferencia: {
        colaboradorId,
        mesReferencia: paraDataUTC(mesReferencia),
      },
    },
    data: { observacao },
  });
}

// Usado pelo guard de imutabilidade (COMIS-06): existe ao menos uma linha
// FECHADA nessa competência? Uma única linha FECHADA já basta para recusar
// nova apuração no mês (o fecho é sempre feito para o mês inteiro).
export async function existeMesFechado(mesReferencia: string): Promise<boolean> {
  const linha = await db.comissaoApurada.findFirst({
    where: { mesReferencia: paraDataUTC(mesReferencia), status: "FECHADA" },
    select: { id: true },
  });
  return linha !== null;
}
