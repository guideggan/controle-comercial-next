import "server-only";

import { db } from "@/lib/db";
import {
  criarPlanoRow,
  fecharVigencia,
  getPlanoVigente as getPlanoVigenteRepo,
  listarPlanosDoColaborador as listarPlanosDoColaboradorRepo,
} from "@/server/repositories/plano-comissao.repo";
import { criarPlanoComissaoSchema } from "@/server/actions/planos-comissao.schemas";
import type { CriarPlanoComissaoInput } from "@/server/actions/planos-comissao.schemas";

// Coração da Fase 2 (COLAB-06): versiona o plano de comissão de um
// colaborador SEM NUNCA reescrever histórico. Ao definir um novo plano:
//   1. valida {tipo, config} com o schema Zod correspondente (rejeita antes
//      de qualquer escrita se a config não bater com o tipo);
//   2. se já existe um plano aberto, fecha-o (grava vigenciaFim) ANTES de
//      criar o novo — nunca depois, para não violar por um instante o
//      índice único parcial de "um único plano aberto por colaborador";
//   3. cria a nova linha aberta (vigenciaFim null);
//   4. os passos 2-3 rodam na MESMA transação (db.$transaction): se a
//      criação da nova linha falhar, o fechamento da anterior é revertido.
//
// NÃO faz authz (vive nas Server Actions do plano 03, via requireRole)
// nem cálculo de comissão (Fase 5) — este service só armazena/versiona/valida.

// Datas de vigência são DATE puro, tratadas como string "YYYY-MM-DD" na
// borda (PITFALLS Pitfall 6: nunca fazer round-trip por `Date` ciente de
// timezone, ou "01/07" pode virar "30/06" dependendo do fuso do processo).
// `diaAnterior` opera só sobre os componentes numéricos da string, sem
// nunca formatar de volta usando toISOString/getters locais.
function diaAnterior(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  // Date.UTC evita qualquer interferência de timezone local do processo;
  // consumimos só os componentes de calendário (getUTC*), nunca os locais.
  const dataUtc = new Date(Date.UTC(ano, mes - 1, dia));
  dataUtc.setUTCDate(dataUtc.getUTCDate() - 1);

  const anoAnterior = dataUtc.getUTCFullYear();
  const mesAnterior = String(dataUtc.getUTCMonth() + 1).padStart(2, "0");
  const diaAnteriorStr = String(dataUtc.getUTCDate()).padStart(2, "0");

  return `${anoAnterior}-${mesAnterior}-${diaAnteriorStr}`;
}

export async function definirPlanoComissao(input: CriarPlanoComissaoInput) {
  // Validação primeiro: config incompatível com o tipo lança aqui, antes de
  // abrir a transação — zero escritas em caso de erro (COLAB-02..05).
  const parsed = criarPlanoComissaoSchema.parse(input);

  return db.$transaction(async (tx) => {
    const atual = await getPlanoVigenteRepo(parsed.colaboradorId);

    if (atual) {
      await fecharVigencia(tx, atual.id, diaAnterior(parsed.vigenciaInicio));
    }

    return criarPlanoRow(tx, {
      colaboradorId: parsed.colaboradorId,
      tipo: parsed.tipo,
      config: parsed.config,
      vigenciaInicio: parsed.vigenciaInicio,
    });
  });
}

// Reexports finos do repo — o service é a fachada pública consumida pelas
// Server Actions do plano 03; nenhuma lógica adicional aqui além de delegar.
export function getPlanoVigente(colaboradorId: string) {
  return getPlanoVigenteRepo(colaboradorId);
}

export function listarPlanosDoColaborador(colaboradorId: string) {
  return listarPlanosDoColaboradorRepo(colaboradorId);
}
