import "server-only";

import {
  getParcelaComVenda,
  marcarParcelaPagaRow,
  reverterParcelaPendenteRow,
  listarRecebimentosDoMes,
} from "@/server/repositories/recebimento.repo";
import {
  marcarParcelaPagaSchema,
  type MarcarParcelaPagaInput,
} from "@/server/actions/recebimentos.schemas";
import {
  agregarRecebidoNoMes,
  type RecebimentoParcela,
} from "@/domain/recebimentos/agregacao";

// Fachada pública da Fase 4 (PGTO-01/02/03), consumida pelas Server Actions
// (recebimentos.actions.ts) — mesmo padrão de venda.service.ts. NÃO faz
// authz aqui (fica nas actions); este service só valida, aplica a trava de
// mês fechado e orquestra repo + agregação pura.

// Marca uma parcela como PAGA (valorRecebido + dataPagamento), bloqueando
// quando a venda da parcela está fechada (PGTO-01).
export async function marcarParcelaPaga(
  parcelaId: string,
  input: MarcarParcelaPagaInput,
) {
  // Validação primeiro: input inválido lança ANTES de qualquer busca/escrita
  // — zero escritas em erro, mesmo padrão de criarVenda.
  const parsed = marcarParcelaPagaSchema.parse(input);

  const parcela = await getParcelaComVenda(parcelaId);
  if (!parcela) {
    throw new Error("Parcela não encontrada");
  }

  // TRAVA DE MÊS FECHADO (PGTO-01): mesmo padrão placeholder de
  // atualizarVenda em venda.service.ts — a Fase 5 substitui esta checagem
  // pela verificação de apuração fechada (mês trancado no motor de
  // comissão).
  if (parcela.venda.fechado) {
    throw new Error("Parcela de um mês fechado não pode ser alterada");
  }

  return marcarParcelaPagaRow(parcelaId, parsed);
}

// Reverte uma parcela para PENDENTE (limpa valorRecebido/dataPagamento),
// com a mesma trava de mês fechado de marcarParcelaPaga.
export async function reverterParcelaPendente(parcelaId: string) {
  const parcela = await getParcelaComVenda(parcelaId);
  if (!parcela) {
    throw new Error("Parcela não encontrada");
  }

  if (parcela.venda.fechado) {
    throw new Error("Parcela de um mês fechado não pode ser alterada");
  }

  return reverterParcelaPendenteRow(parcelaId);
}

// Fonte única do "recebido no mês" (PGTO-02/PGTO-03) consumida pelo motor
// de comissão da Fase 5 e pelos dashboards das Fases 6/9 — a soma
// sem-dupla-contagem é delegada à função pura do plano 04-01
// (agregarRecebidoNoMes), nunca reimplementada aqui. Este service só busca
// as parcelas PAGAS da competência e converte Decimal→number uma única vez
// (fronteira banco → domínio puro).
export async function recebidoNoMes(mesReferencia: string) {
  const linhas = await listarRecebimentosDoMes(mesReferencia);

  const recebimentos: RecebimentoParcela[] = linhas.map((p) => ({
    parcelaId: p.id,
    vendaId: p.vendaId,
    tipo: p.tipo,
    mesReferencia: mesReferenciaParaString(p.mesReferencia),
    status: p.statusPagamento,
    valorRecebido: p.valorRecebido !== null ? Number(p.valorRecebido) : null,
    closerId: p.venda.closerId,
    sdrId: p.venda.sdrId,
  }));

  return agregarRecebidoNoMes(recebimentos, mesReferencia);
}

// Converte o `Date` (@db.Date) de mesReferencia de volta para "YYYY-MM-01",
// usando getters `getUTC*` (nunca `.toISOString()` ciente de timezone
// local) — mesma convenção de timezone-safety de venda.repo.ts/Pitfall 6.
function mesReferenciaParaString(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}-01`;
}
