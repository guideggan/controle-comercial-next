import "server-only";

import type { ParcelaTipo } from "@prisma/client";

import { db } from "@/lib/db";
import {
  criarVendaRow,
  inserirParcelas,
  apagarParcelasPendentes,
  getVenda as getVendaRepo,
  atualizarVendaRow,
  listarVendas as listarVendasRepo,
  type InserirParcelaData,
  type ListarVendasFiltros,
} from "@/server/repositories/venda.repo";
import { vendaSchema } from "@/server/actions/vendas.schemas";
import type { VendaInput } from "@/server/actions/vendas.schemas";
import {
  gerarCronogramaParcelas,
  type ParcelaGerada,
} from "@/domain/vendas/parcelas";

// Coração da Fase 3 (VENDA-02): materializa a venda + o cronograma de
// parcelas gerado pelo módulo puro de domínio (src/domain/vendas/parcelas.ts)
// numa única transação atômica — se a inserção das parcelas falhar, a venda
// não fica órfã (Pitfall do plano 03-03).
//
// NÃO faz authz (vive nas Server Actions do plano 03-03, via requireRole)
// — este service só valida, monta o cronograma e persiste.

// Os tipos do domínio ("ENTRADA"/"MENSALIDADE"/"AVISTA") usam exatamente os
// mesmos literais do enum ParcelaTipo do Prisma — confirmado em
// prisma/schema.prisma. Este cast documenta essa igualdade no ponto de
// fronteira entre as duas camadas, sem reimplementar nada.
function mapearTipoParcela(tipo: ParcelaGerada["tipo"]): ParcelaTipo {
  return tipo as ParcelaTipo;
}

// Mapeamento domínio → prisma extraído como função pura e determinística
// (sem DB), para ser testável isoladamente — a lógica de cronograma em si já
// é coberta pelos testes do 03-01; aqui garantimos apenas que o formato de
// inserção do repo (InserirParcelaData) recebe vendaId + os campos exatos
// de cada ParcelaGerada.
export function montarParcelasParaInsercao(
  vendaId: string,
  cronograma: ParcelaGerada[],
): InserirParcelaData[] {
  return cronograma.map((p) => ({
    vendaId,
    tipo: mapearTipoParcela(p.tipo),
    numero: p.numero,
    mesReferencia: p.mesReferencia,
    dataVencimento: p.dataVencimento,
    valorPrevisto: p.valorPrevisto,
  }));
}

// Converte o tipoPagamento do schema Zod ("A_VISTA"/"MENSALISTA") para o
// literal esperado pelo domínio ("a_vista"/"mensalista") — único ponto de
// tradução entre a borda (Prisma/Zod) e o módulo 100% puro do 03-01.
function paraTipoPagamentoDominio(
  tipoPagamento: VendaInput["tipoPagamento"],
): "a_vista" | "mensalista" {
  return tipoPagamento === "A_VISTA" ? "a_vista" : "mensalista";
}

export async function criarVenda(input: VendaInput) {
  // Validação primeiro: input incompatível com as regras à vista/mensalista
  // lança aqui, antes de abrir a transação — zero escritas em caso de erro.
  const parsed = vendaSchema.parse(input);

  const cronograma = gerarCronogramaParcelas({
    tipoPagamento: paraTipoPagamentoDominio(parsed.tipoPagamento),
    mesReferenciaInicial: parsed.mesReferencia,
    diaVencimento: parsed.diaVencimento,
    valorTotal: parsed.valorTotal,
    entrada: parsed.entrada,
    valorMensalidade: parsed.valorMensalidade,
    numeroParcelas: parsed.numeroParcelas,
  });

  return db.$transaction(async (tx) => {
    const venda = await criarVendaRow(tx, {
      dataVenda: parsed.dataVenda,
      alunoNome: parsed.alunoNome,
      pagadorNome: parsed.pagadorNome,
      plataforma: parsed.plataforma,
      produtoId: parsed.produtoId,
      tipoPagamento: parsed.tipoPagamento,
      valorTotal: parsed.valorTotal,
      entrada: parsed.entrada,
      valorMensalidade: parsed.valorMensalidade,
      numeroParcelas: parsed.numeroParcelas,
      diaVencimento: parsed.diaVencimento,
      mesReferencia: parsed.mesReferencia,
      closerId: parsed.closerId,
      sdrId: parsed.sdrId,
      observacao: parsed.observacao,
    });

    await inserirParcelas(tx, montarParcelasParaInsercao(venda.id, cronograma));

    return venda;
  });
}

export async function atualizarVenda(id: string, input: VendaInput) {
  // requireRole/authz NÃO aqui — fica na Server Action (vendas.actions.ts).
  const vendaAtual = await getVendaRepo(id);

  // Trava placeholder VENDA-04: a Fase 5 substitui esta checagem pela
  // verificação de apuração fechada (mês trancado no motor de comissão).
  // Por ora, basta o flag `fechado` da própria venda.
  if (vendaAtual?.fechado) {
    throw new Error("Venda de um mês fechado não pode ser editada");
  }

  const parsed = vendaSchema.parse(input);

  const cronograma = gerarCronogramaParcelas({
    tipoPagamento: paraTipoPagamentoDominio(parsed.tipoPagamento),
    mesReferenciaInicial: parsed.mesReferencia,
    diaVencimento: parsed.diaVencimento,
    valorTotal: parsed.valorTotal,
    entrada: parsed.entrada,
    valorMensalidade: parsed.valorMensalidade,
    numeroParcelas: parsed.numeroParcelas,
  });

  return db.$transaction(async (tx) => {
    const venda = await atualizarVendaRow(tx, id, {
      dataVenda: parsed.dataVenda,
      alunoNome: parsed.alunoNome,
      pagadorNome: parsed.pagadorNome,
      plataforma: parsed.plataforma,
      produtoId: parsed.produtoId,
      tipoPagamento: parsed.tipoPagamento,
      valorTotal: parsed.valorTotal,
      entrada: parsed.entrada,
      valorMensalidade: parsed.valorMensalidade,
      numeroParcelas: parsed.numeroParcelas,
      diaVencimento: parsed.diaVencimento,
      mesReferencia: parsed.mesReferencia,
      closerId: parsed.closerId,
      sdrId: parsed.sdrId,
      observacao: parsed.observacao,
    });

    // Estratégia de parcelas na edição: apaga só as parcelas PENDENTES e
    // reinsere o cronograma recalculado a partir dos novos dados da venda,
    // preservando SEMPRE as parcelas já PAGAS (nunca tocadas). Isso vale
    // tanto para à vista (regenera a única parcela pendente) quanto para
    // mensalista (regenera entrada+mensalidades ainda não pagas).
    await apagarParcelasPendentes(tx, id);
    await inserirParcelas(tx, montarParcelasParaInsercao(id, cronograma));

    return venda;
  });
}

// Reexports finos do repo — o service é a fachada pública consumida pelas
// Server Actions do plano 03-03; nenhuma lógica adicional aqui além de
// delegar (mesmo padrão de plano-comissao.service.ts).
export function getVenda(id: string) {
  return getVendaRepo(id);
}

export function listarVendas(filtros?: ListarVendasFiltros) {
  return listarVendasRepo(filtros);
}
