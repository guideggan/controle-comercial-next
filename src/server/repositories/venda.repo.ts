import "server-only";

import type {
  Prisma,
  ParcelaTipo,
  StatusPagamento,
  StatusAprovacao,
} from "@prisma/client";

import { db } from "@/lib/db";

// Repositório de acesso a dados de Venda/Parcela — funções puras, sem authz
// (mesmo padrão de colaborador.repo.ts / produto.repo.ts / plano-comissao.repo.ts).
// A autorização (requireRole("ADMIN")) vive nas Server Actions do plano 03
// (vendas.actions.ts); a orquestração transacional (venda + parcelas
// atômicas, VENDA-02) vive no service (venda.service.ts), que decide QUANDO
// chamar cada função abaixo e com qual `tx`.

// Cliente Prisma "genérico" o suficiente para aceitar tanto `db` quanto o
// `tx` recebido dentro de um `db.$transaction(async (tx) => ...)` — mesmo
// padrão de `criarPlanoRow` em plano-comissao.repo.ts. Venda+Parcela
// precisam ser criadas na mesma transação, por isso o tipo cobre os dois
// modelos.
type VendaClient = Pick<typeof db, "venda" | "parcela">;

// Converte "YYYY-MM-DD" para um `Date` em meia-noite UTC antes de escrever
// em uma coluna @db.Date. Bug descoberto durante o smoke test do plano
// 03-04 (Rule 1): o Prisma Client 6.19.3 rejeita string "YYYY-MM-DD" pura em
// campos DateTime/Date ("Invalid value ... premature end of input. Expected
// ISO-8601 DateTime") — precisa de um `Date` (ou string ISO-8601 completa).
// Nunca usar `new Date("YYYY-MM-DD")` diretamente aqui: em alguns runtimes
// isso é interpretado como UTC (ok), mas para manter a mesma convenção de
// timezone-safety do resto do projeto (Pitfall 6) construímos o `Date`
// explicitamente via `Date.UTC` a partir dos componentes da string.
function paraDataUTC(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

export type CriarVendaRowData = {
  dataVenda: string; // "YYYY-MM-DD", tratado como DATE puro (Pitfall 6)
  alunoNome: string;
  pagadorNome: string;
  plataforma: Prisma.VendaCreateInput["plataforma"];
  produtoId: string;
  tipoPagamento: Prisma.VendaCreateInput["tipoPagamento"];
  valorTotal: number;
  entrada: number;
  valorMensalidade: number;
  numeroParcelas: number;
  diaVencimento: number;
  mesReferencia: string; // "YYYY-MM-01", DATE puro
  closerId: string;
  sdrId?: string | null;
  observacao?: string | null;
  // Aprovação (v1.1): venda criada por ADMIN nasce APROVADA (default do
  // banco); venda criada por CLOSER nasce PENDENTE_APROVACAO — decidido pelo
  // service (venda.service.ts), nunca aceito do client.
  statusAprovacao?: StatusAprovacao;
  criadaPorId?: string | null;
  linkCrm?: string | null;
};

export type InserirParcelaData = {
  vendaId: string;
  tipo: ParcelaTipo;
  numero: number;
  mesReferencia: string; // "YYYY-MM-01", DATE puro
  dataVencimento: string; // "YYYY-MM-DD", DATE puro
  valorPrevisto: number;
  // Fase 11: componente de origem. Null nas parcelas geradas pelo caminho
  // escalar do v1 e em todo o histórico da Fase 10 — é o que permite ao
  // cálculo de valor presente saber se esta parcela já foi contada cheia.
  componenteId?: string | null;
};

export type AtualizarVendaRowData = {
  dataVenda: string;
  alunoNome: string;
  pagadorNome: string;
  plataforma: Prisma.VendaCreateInput["plataforma"];
  produtoId: string;
  tipoPagamento: Prisma.VendaCreateInput["tipoPagamento"];
  valorTotal: number;
  entrada: number;
  valorMensalidade: number;
  numeroParcelas: number;
  diaVencimento: number;
  mesReferencia: string;
  closerId: string;
  sdrId?: string | null;
  observacao?: string | null;
};

export type ListarVendasFiltros = {
  alunoNome?: string;
  closerId?: string;
  produtoId?: string;
  statusPagamento?: StatusPagamento;
  mesReferencia?: string; // "YYYY-MM-01"
  statusAprovacao?: StatusAprovacao;
};

// Cria a linha da venda. Recebe `tx` como primeiro parâmetro para compor
// dentro da transação atômica do service — nunca chamada fora de uma
// transação em produção (VENDA-02: venda nunca fica órfã sem parcelas).
export function criarVendaRow(tx: VendaClient, data: CriarVendaRowData) {
  return tx.venda.create({
    data: {
      dataVenda: paraDataUTC(data.dataVenda),
      alunoNome: data.alunoNome,
      pagadorNome: data.pagadorNome,
      plataforma: data.plataforma,
      produtoId: data.produtoId,
      tipoPagamento: data.tipoPagamento,
      valorTotal: data.valorTotal,
      entrada: data.entrada,
      valorMensalidade: data.valorMensalidade,
      numeroParcelas: data.numeroParcelas,
      diaVencimento: data.diaVencimento,
      mesReferencia: paraDataUTC(data.mesReferencia),
      closerId: data.closerId,
      sdrId: data.sdrId ?? null,
      observacao: data.observacao ?? null,
      statusAprovacao: data.statusAprovacao ?? "APROVADA",
      criadaPorId: data.criadaPorId ?? null,
      linkCrm: data.linkCrm ?? null,
    },
  });
}

// Insere o cronograma de parcelas já calculado pelo domínio
// (src/domain/vendas/parcelas.ts) — sempre chamada na MESMA transação de
// criarVendaRow pelo service, nunca isoladamente em produção.
export function inserirParcelas(tx: VendaClient, parcelas: InserirParcelaData[]) {
  return tx.parcela.createMany({
    data: parcelas.map((p) => ({
      vendaId: p.vendaId,
      tipo: p.tipo,
      numero: p.numero,
      mesReferencia: paraDataUTC(p.mesReferencia),
      dataVencimento: paraDataUTC(p.dataVencimento),
      valorPrevisto: p.valorPrevisto,
      componenteId: p.componenteId ?? null,
    })),
  });
}

// Apaga apenas as parcelas PENDENTES de uma venda — usada pelo service ao
// regenerar o cronograma em uma edição, nunca tocando parcelas já PAGAS.
export function apagarParcelasPendentes(tx: VendaClient, vendaId: string) {
  return tx.parcela.deleteMany({
    where: { vendaId, statusPagamento: "PENDENTE" },
  });
}

export function getVenda(id: string) {
  return db.venda.findUnique({
    where: { id },
    include: {
      produto: true,
      closer: true,
      sdr: true,
      parcelas: { orderBy: [{ tipo: "asc" }, { numero: "asc" }] },
    },
  });
}

// Atualiza os campos editáveis da venda. NÃO regenera parcelas aqui — a
// estratégia de regeneração (apagar pendentes + reinserir cronograma
// recalculado, preservando pagas) é orquestrada pelo service
// (venda.service.ts), dentro da mesma transação desta chamada.
export function atualizarVendaRow(
  tx: VendaClient,
  id: string,
  data: AtualizarVendaRowData,
) {
  return tx.venda.update({
    where: { id },
    data: {
      dataVenda: paraDataUTC(data.dataVenda),
      alunoNome: data.alunoNome,
      pagadorNome: data.pagadorNome,
      plataforma: data.plataforma,
      produtoId: data.produtoId,
      tipoPagamento: data.tipoPagamento,
      valorTotal: data.valorTotal,
      entrada: data.entrada,
      valorMensalidade: data.valorMensalidade,
      numeroParcelas: data.numeroParcelas,
      diaVencimento: data.diaVencimento,
      mesReferencia: paraDataUTC(data.mesReferencia),
      closerId: data.closerId,
      sdrId: data.sdrId ?? null,
      observacao: data.observacao ?? null,
    },
  });
}

// Placeholder da trava de edição da Fase 5 (apuração fechada bloqueia
// edição da venda) — usada por scripts/administração pontual; a checagem de
// leitura antes de bloquear vive no service (atualizarVenda).
export function setVendaFechado(id: string, fechado: boolean) {
  return db.venda.update({
    where: { id },
    data: { fechado },
  });
}

// Listagem com filtros opcionais (VENDA-05), consumida pela UI de
// busca/filtro do plano 04. orderBy dataVenda desc (mais recente primeiro).
//
// Por padrão lista TODAS as vendas (qualquer statusAprovacao) — a listagem
// administrativa precisa mostrar pendentes/rejeitadas com o status visível
// (v1.1); quem precisa contar só o que é receita/comissão (dashboard) passa
// `statusAprovacao: "APROVADA"` explicitamente.
export function listarVendas(filtros: ListarVendasFiltros = {}) {
  const where: Prisma.VendaWhereInput = {};

  if (filtros.alunoNome) {
    where.alunoNome = { contains: filtros.alunoNome, mode: "insensitive" };
  }
  if (filtros.closerId) {
    where.closerId = filtros.closerId;
  }
  if (filtros.produtoId) {
    where.produtoId = filtros.produtoId;
  }
  if (filtros.mesReferencia) {
    where.mesReferencia = paraDataUTC(filtros.mesReferencia);
  }
  if (filtros.statusPagamento) {
    where.parcelas = { some: { statusPagamento: filtros.statusPagamento } };
  }
  if (filtros.statusAprovacao) {
    where.statusAprovacao = filtros.statusAprovacao;
  }

  return db.venda.findMany({
    where,
    orderBy: { dataVenda: "desc" },
    include: { produto: true, closer: true, _count: { select: { parcelas: true } } },
  });
}

// Fila de aprovação do ADMIN (v1.1): vendas criadas por um CLOSER, ainda não
// decididas. orderBy dataVenda asc (mais antiga primeiro, FIFO da fila).
export function listarVendasPendentesAprovacao() {
  return db.venda.findMany({
    where: { statusAprovacao: "PENDENTE_APROVACAO" },
    orderBy: { dataVenda: "asc" },
    include: { produto: true, closer: true, sdr: true, criadaPor: true },
  });
}

export type DecidirVendaRowData = {
  status: Extract<StatusAprovacao, "APROVADA" | "REJEITADA">;
  aprovadaPorId: string;
  aprovadaEm: Date;
};

// Grava a decisão (aprovar/rejeitar) de uma venda pendente — usada por
// aprovarVenda/rejeitarVenda em vendas.actions.ts (requireRole ADMIN).
export function decidirVendaRow(id: string, data: DecidirVendaRowData) {
  return db.venda.update({
    where: { id },
    data: {
      statusAprovacao: data.status,
      aprovadaPorId: data.aprovadaPorId,
      aprovadaEm: data.aprovadaEm,
    },
  });
}
