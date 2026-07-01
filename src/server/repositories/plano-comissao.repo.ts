import "server-only";

import type { Prisma, PlanoTipo } from "@prisma/client";

import { db } from "@/lib/db";

// Repositório de acesso a dados de PlanoComissao — funções puras, sem authz
// (mesmo padrão de colaborador.repo.ts / produto.repo.ts). A autorização
// (requireRole("ADMIN")) vive nas Server Actions do plano 03; a orquestração
// de versionamento (fechar + abrir na mesma transação) vive no service
// (plano-comissao.service.ts), que é quem decide QUANDO chamar cada função
// abaixo e com qual `tx`.

// Cliente Prisma "genérico" o suficiente para aceitar tanto `db` quanto o
// `tx` recebido dentro de um `db.$transaction(async (tx) => ...)` — mesmo
// padrão de `criarColaboradorRow` em colaborador.repo.ts.
type PlanoComissaoClient = Pick<typeof db, "planoComissao">;

// Converte "YYYY-MM-DD" em Date UTC puro. O Prisma Client 6.19.x rejeita
// strings cruas em colunas @db.Date — precisa ser um objeto Date (Pitfall 6).
function paraDataUTC(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

export type CriarPlanoRowData = {
  colaboradorId: string;
  tipo: PlanoTipo;
  config: Prisma.InputJsonValue;
  vigenciaInicio: string; // "YYYY-MM-DD", tratado como DATE puro (Pitfall 6)
};

// Cria a nova linha de plano, sempre aberta (vigenciaFim null). Recebe `tx`
// como primeiro parâmetro para compor dentro da transação de versionamento
// do service — nunca chamada fora de uma transação em produção, mas aceita
// `db` diretamente também (útil em testes/scripts pontuais).
export function criarPlanoRow(
  tx: PlanoComissaoClient,
  data: CriarPlanoRowData,
) {
  return tx.planoComissao.create({
    data: {
      colaboradorId: data.colaboradorId,
      tipo: data.tipo,
      config: data.config,
      vigenciaInicio: paraDataUTC(data.vigenciaInicio),
      vigenciaFim: null,
    },
  });
}

// Fecha a vigência de um plano existente gravando `vigenciaFim` — nunca
// altera `tipo`/`config`, preservando o histórico exato do que valia naquele
// período. `vigenciaFim` é uma string "YYYY-MM-DD" (mesma convenção de
// vigenciaInicio) calculada pelo service (diaAnterior), nunca aqui.
export function fecharVigencia(
  tx: PlanoComissaoClient,
  planoId: string,
  vigenciaFim: string,
) {
  return tx.planoComissao.update({
    where: { id: planoId },
    data: { vigenciaFim: paraDataUTC(vigenciaFim) },
  });
}

// Retorna o plano aberto (vigenciaFim null) do colaborador, ou null se ele
// nunca teve um plano definido. Usa `db` diretamente (leitura fora de
// transação é segura; a decisão de versionamento é feita pelo service com
// base neste resultado, antes de abrir a transação de escrita).
export function getPlanoVigente(colaboradorId: string) {
  return db.planoComissao.findFirst({
    where: { colaboradorId, vigenciaFim: null },
  });
}

// Histórico completo de planos do colaborador, mais recente primeiro
// (orderBy vigenciaInicio desc) — consumido pela UI de histórico do plano 03.
export function listarPlanosDoColaborador(colaboradorId: string) {
  return db.planoComissao.findMany({
    where: { colaboradorId },
    orderBy: { vigenciaInicio: "desc" },
  });
}
