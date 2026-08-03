import "server-only";

import type { ParcelaTipo, Papel } from "@prisma/client";

import { db } from "@/lib/db";
import {
  criarVendaRow,
  inserirParcelas,
  apagarParcelasPendentes,
  getVenda as getVendaRepo,
  atualizarVendaRow,
  listarVendas as listarVendasRepo,
  listarVendasPendentesAprovacao as listarVendasPendentesAprovacaoRepo,
  decidirVendaRow,
  type InserirParcelaData,
  type ListarVendasFiltros,
} from "@/server/repositories/venda.repo";
import { vendaSchema, vendaSchemaParaCloser } from "@/server/actions/vendas.schemas";
import type { VendaInput } from "@/server/actions/vendas.schemas";
import {
  gerarCronogramaParcelas,
  type ParcelaGerada,
} from "@/domain/vendas/parcelas";
import {
  gerarCronogramaDeComponentes,
  type ComponentePagamento,
} from "@/domain/vendas/componentes";
import { resolverComponentes } from "@/server/actions/componentes.schemas";
import {
  inserirComponentes,
  apagarComponentes,
} from "@/server/repositories/componente.repo";
import { registrarAudit } from "@/server/services/audit.service";

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

// Contexto de quem está criando a venda (v1.1, VENDA-11/12): ADMIN cria uma
// venda já APROVADA (comportamento idêntico ao anterior a esta mudança,
// zero regressão); CLOSER cria uma venda PENDENTE_APROVACAO, com linkCrm
// OBRIGATÓRIO (validado por vendaSchemaParaCloser). Opcional para não
// quebrar nenhum chamador existente (scripts, testes) — omitir `criador`
// preserva o comportamento anterior (ADMIN implícito, sem criadaPorId).
export type CriadorVenda = {
  role: Papel;
  colaboradorId: string;
};

// Fase 11 — DOIS CAMINHOS DE CRONOGRAMA, temporariamente coexistindo:
//
//   COM componentes  → gerarCronogramaDeComponentes (src/domain/vendas/componentes.ts)
//                      é o caminho novo, e o único que permite calcular valor
//                      presente. Cada parcela nasce ligada ao componente que
//                      a originou.
//   SEM componentes  → gerarCronogramaParcelas (src/domain/vendas/parcelas.ts)
//                      é o caminho do v1, preservado byte a byte. Continua
//                      atendendo o importador da Fase 10, os scripts e todo
//                      chamador que ainda não passa componentes.
//
// A coexistência é deliberada e TEMPORÁRIA: quando a UI de componentes
// substituir o formulário escalar e o backfill tiver convertido o histórico,
// o caminho do v1 pode ser removido. Enquanto os dois existem, `componentes`
// é a fonte de verdade quando presente — nunca os dois ao mesmo tempo.
async function persistirCronograma(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  vendaId: string,
  parsed: VendaInput,
) {
  const temComponentes = parsed.componentes && parsed.componentes.length > 0;

  if (!temComponentes) {
    const cronograma = gerarCronogramaParcelas({
      tipoPagamento: paraTipoPagamentoDominio(parsed.tipoPagamento),
      mesReferenciaInicial: parsed.mesReferencia,
      diaVencimento: parsed.diaVencimento,
      valorTotal: parsed.valorTotal,
      entrada: parsed.entrada,
      valorMensalidade: parsed.valorMensalidade,
      numeroParcelas: parsed.numeroParcelas,
    });
    await inserirParcelas(tx, montarParcelasParaInsercao(vendaId, cronograma));
    return;
  }

  const componentes: ComponentePagamento[] = resolverComponentes(
    parsed.componentes!,
  );

  // Componentes primeiro: precisamos dos ids gerados para vincular cada
  // parcela ao seu componente de origem. Tudo na mesma transação do caller.
  const componenteIds = await inserirComponentes(
    tx,
    vendaId,
    componentes.map((c, ordem) => ({ ...c, ordem })),
  );

  const cronograma = gerarCronogramaDeComponentes(componentes);

  await inserirParcelas(
    tx,
    cronograma.map((p) => ({
      vendaId,
      tipo: mapearTipoParcela(p.tipo),
      numero: p.numero,
      mesReferencia: p.mesReferencia,
      dataVencimento: p.dataVencimento,
      valorPrevisto: p.valorPrevisto,
      componenteId: componenteIds[p.componenteIndice] ?? null,
    })),
  );
}

export async function criarVenda(input: VendaInput, criador?: CriadorVenda) {
  const ehCloser = criador?.role === "CLOSER";

  // Validação primeiro: input incompatível com as regras à vista/mensalista
  // (ou, quando criado por closer, sem linkCrm) lança aqui, antes de abrir a
  // transação — zero escritas em caso de erro.
  const parsed = ehCloser
    ? vendaSchemaParaCloser.parse(input)
    : vendaSchema.parse(input);

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
      statusAprovacao: ehCloser ? "PENDENTE_APROVACAO" : "APROVADA",
      criadaPorId: criador?.colaboradorId ?? null,
      linkCrm: parsed.linkCrm ?? null,
    });

    await persistirCronograma(tx, venda.id, parsed);

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
    //
    // Fase 11: os componentes são substituídos junto (apagar + reinserir),
    // pela mesma razão — eles descrevem o mesmo plano de pagamento que o
    // cronograma materializa. As parcelas PAGAS que apontavam para um
    // componente apagado ficam com `componenteId = NULL` (FK
    // `onDelete: SetNull`), o que é o comportamento correto: a parcela paga é
    // um fato consumado, o componente que a previa deixou de existir.
    //
    // ATENÇÃO (dívida conhecida, ver HANDOFF-DEV.md): uma parcela paga órfã
    // de componente volta a ser tratada como `origemContaCheio: false` pelo
    // cálculo de valor presente. Para venda com cartão parcelado editada
    // depois de já ter recebimento, isso pode superestimar o valor presente
    // do mês. A Fase 13 precisa resolver antes de a comissão passar a
    // depender desse número.
    await apagarParcelasPendentes(tx, id);
    await apagarComponentes(tx, id);
    await persistirCronograma(tx, id, parsed);

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

export function listarVendasPendentesAprovacao() {
  return listarVendasPendentesAprovacaoRepo();
}

// Aprova/rejeita uma venda pendente (v1.1, VENDA-11): só passa a contar em
// receita/comissão/dashboard depois de APROVADA (gate vive em
// recebimento.repo.ts/listarRecebimentosDoMes). Idempotente por natureza —
// decidir de novo simplesmente sobrescreve quem/quando decidiu; a ação fica
// registrada em AuditLog para rastreabilidade (AUDIT-01).
async function decidirVenda(
  id: string,
  status: "APROVADA" | "REJEITADA",
  aprovadaPorId: string,
) {
  const vendaAtual = await getVendaRepo(id);
  if (!vendaAtual) {
    throw new Error("Venda não encontrada");
  }
  if (vendaAtual.statusAprovacao !== "PENDENTE_APROVACAO") {
    throw new Error("Venda já foi decidida (aprovada ou rejeitada)");
  }

  const aprovadaEm = new Date();
  const venda = await decidirVendaRow(id, { status, aprovadaPorId, aprovadaEm });

  await registrarAudit({
    acao: status === "APROVADA" ? "APROVAR_VENDA" : "REJEITAR_VENDA",
    entidade: "venda",
    entidadeId: id,
    usuarioId: aprovadaPorId,
    dadosAntes: { statusAprovacao: "PENDENTE_APROVACAO" },
    dadosDepois: { statusAprovacao: status },
  });

  return venda;
}

export function aprovarVenda(id: string, aprovadaPorId: string) {
  return decidirVenda(id, "APROVADA", aprovadaPorId);
}

export function rejeitarVenda(id: string, aprovadaPorId: string) {
  return decidirVenda(id, "REJEITADA", aprovadaPorId);
}
