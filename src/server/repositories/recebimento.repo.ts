import "server-only";

import { db } from "@/lib/db";

// Repositório de acesso a dados de recebimento de parcela (Fase 4) —
// funções puras, sem authz (mesmo padrão de venda.repo.ts). A autorização
// (requireRole("ADMIN")) vive nas Server Actions (recebimentos.actions.ts);
// a trava de mês fechado (PGTO-01) vive no service (recebimento.service.ts).

// Converte "YYYY-MM-DD" para um `Date` em meia-noite UTC antes de escrever
// em uma coluna @db.Date. Mesmo bug documentado em venda.repo.ts
// (deferred-items.md da Fase 3): o Prisma Client 6.19.3 rejeita string
// "YYYY-MM-DD" pura em campos DateTime/Date — precisa de um `Date`.
// Construído explicitamente via `Date.UTC` a partir dos componentes da
// string (nunca `new Date(string)`), mantendo a mesma convenção de
// timezone-safety do resto do projeto (Pitfall 6).
function paraDataUTC(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

export type MarcarParcelaPagaRowData = {
  valorRecebido: number;
  dataPagamento: string; // "YYYY-MM-DD", DATE puro (Pitfall 6)
};

// Busca a parcela com a venda relacionada — o service precisa de
// `venda.fechado` (trava PGTO-01) e `venda.closerId`/`venda.sdrId` para a
// agregação de recebidoNoMes.
export function getParcelaComVenda(id: string) {
  return db.parcela.findUnique({
    where: { id },
    include: { venda: true },
  });
}

// Marca a parcela como PAGA, gravando valorRecebido e dataPagamento. NÃO
// verifica mês fechado aqui — a trava vive no service, ANTES desta chamada.
export function marcarParcelaPagaRow(
  id: string,
  data: MarcarParcelaPagaRowData,
) {
  return db.parcela.update({
    where: { id },
    data: {
      statusPagamento: "PAGO",
      valorRecebido: data.valorRecebido,
      dataPagamento: paraDataUTC(data.dataPagamento),
    },
  });
}

// Reverte a parcela para PENDENTE, limpando valorRecebido e dataPagamento
// (PGTO-01: reverter é a operação inversa exata de marcar pago).
export function reverterParcelaPendenteRow(id: string) {
  return db.parcela.update({
    where: { id },
    data: {
      statusPagamento: "PENDENTE",
      valorRecebido: null,
      dataPagamento: null,
    },
  });
}

// Lista as parcelas PAGAS de uma competência, trazendo os campos que a
// agregação pura (src/domain/recebimentos/agregacao.ts) precisa. Filtrar
// por PAGO já no banco é uma otimização segura — a agregação pura reforça
// a regra de qualquer forma (PGTO-03), então nenhuma parcela pendente
// jamais contribui, mesmo que este filtro fosse removido por engano.
export function listarRecebimentosDoMes(mesReferencia: string) {
  return db.parcela.findMany({
    where: {
      mesReferencia: paraDataUTC(mesReferencia),
      statusPagamento: "PAGO",
    },
    include: {
      venda: { select: { id: true, closerId: true, sdrId: true } },
    },
  });
}
