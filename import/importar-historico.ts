#!/usr/bin/env -S npx tsx
// ============================================================
// IMPORTAÇÃO DO HISTÓRICO (Fase 10 — IMPORT-01/02/03)
// ============================================================
// Script standalone (tsx, NÃO web runtime) que carrega o histórico de
// "Comissões_Vendas - NEXT.xlsx" no banco: colaboradores, produtos, vendas,
// parcelas e um snapshot de comissão apurada por (colaborador, mês),
// recomputado a partir dos FATOS BRUTOS de cada linha (valor recebido no
// mês × % histórico daquela linha) — nunca copiando a coluna
// COMISSÃO/FÓRMULA da planilha como verdade (Pitfall 9).
//
// ESCOPO DELIBERADAMENTE REDUZIDO (documentado, não um bug):
// "Desempenho Time - NEXT (1).xlsx" (metas semanais + agendamentos SDR/SS)
// tem um layout de blocos livres separados por linhas em branco, com
// formatos de data/coluna inconsistentes entre pessoas e semanas — não é
// uma estrutura tabular machine-parseable com confiança suficiente para
// IMPORT-01 no orçamento desta fase. Metas/agendamentos históricos NÃO são
// importados; o sistema começa a rastrear metas/agendamentos a partir de
// hoje (já suportado pelas Fases 6/7). Ver Phase 10 SUMMARY.
//
// Uso:
//   npx tsx import/importar-historico.ts                 (dry-run, não grava nada)
//   npx tsx import/importar-historico.ts --apply          (grava no banco)
//   npx tsx import/importar-historico.ts --apply --arquivo "outra planilha.xlsx"
//
// Idempotência (IMPORT-03): toda escrita é um upsert por CHAVE NATURAL —
// colaborador por nome, produto por nome, venda por
// (alunoNome + dataVenda + valorTotal), parcela por (vendaId, tipo,
// numero — mesma constraint única já existente no schema). Rodar o script
// duas vezes seguidas com --apply produz o MESMO estado final, sem duplicar
// nenhuma linha.
import "server-only";

import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";

import { arredondar, toDecimal } from "@/domain/comissao/money";
import {
  gerarCronogramaParcelas,
  type TipoPagamento as TipoPagamentoDominio,
} from "@/domain/vendas/parcelas";

import {
  abrirWorkbook,
  lerAbaMensal,
  listarAbasIgnoradas,
  listarAbasMensais,
} from "./planilha";
import {
  normalizarLinhaVenda,
  type LinhaBruta,
  type VendaNormalizada,
} from "./normalizacao";
import {
  agregarPorPessoaMes,
  reconciliarLinhas,
  recomputarComissaoLinha,
  type LinhaParaReconciliar,
} from "./reconciliacao";

const db = new PrismaClient();

// As planilhas de origem contêm PII (nomes, pagadores) e vivem FORA do repo,
// numa pasta irmã ("Controle Comercial NEXT - Dados/planilhas"). O caminho é
// resolvido a partir do cwd (raiz do projeto); use --arquivo para apontar
// para outro lugar.
const ARQUIVO_PADRAO =
  "../Controle Comercial NEXT - Dados/planilhas/Comissões_Vendas - NEXT.xlsx";

type LinhaProcessada = {
  numeroLinha: number;
  nomeAba: string;
  venda: VendaNormalizada;
  comissaoCloserPlanilha: unknown;
  comissaoSdrPlanilha: unknown;
};

type LinhaRejeitadaRelatorio = {
  numeroLinha: number;
  nomeAba: string;
  motivo: string;
  aluno: string;
};

// ------------------------------------------------------------------
// 1) PARSE — lê todas as abas mensais reconhecidas, normaliza cada linha.
// ------------------------------------------------------------------

function extrairEnormalizar(caminhoArquivo: string): {
  processadas: LinhaProcessada[];
  rejeitadas: LinhaRejeitadaRelatorio[];
  abasProcessadas: string[];
  abasIgnoradas: string[];
} {
  const workbook = abrirWorkbook(caminhoArquivo);
  const abas = listarAbasMensais(workbook);
  const abasIgnoradas = listarAbasIgnoradas(workbook);

  const processadas: LinhaProcessada[] = [];
  const rejeitadas: LinhaRejeitadaRelatorio[] = [];

  for (const nomeAba of abas) {
    const { linhas } = lerAbaMensal(workbook, nomeAba);

    for (const { numeroLinha, bruta } of linhas) {
      const resultado = normalizarLinhaVenda(bruta);
      if (!resultado.ok) {
        rejeitadas.push({
          numeroLinha,
          nomeAba,
          motivo: resultado.motivo,
          aluno: String((bruta as LinhaBruta).aluno ?? "(sem aluno)"),
        });
        continue;
      }

      processadas.push({
        numeroLinha,
        nomeAba,
        venda: resultado.venda,
        comissaoCloserPlanilha: bruta.comissaoCloser,
        comissaoSdrPlanilha: bruta.comissaoSdr,
      });
    }
  }

  return { processadas, rejeitadas, abasProcessadas: abas, abasIgnoradas };
}

// ------------------------------------------------------------------
// 2) VALIDAÇÃO / DRY-RUN — resume o que SERIA importado + anomalias.
// ------------------------------------------------------------------

function nomesUnicos(processadas: LinhaProcessada[]): {
  colaboradores: Set<string>;
  produtos: Set<string>;
} {
  const colaboradores = new Set<string>();
  const produtos = new Set<string>();
  for (const { venda } of processadas) {
    if (venda.closerNome) colaboradores.add(venda.closerNome);
    if (venda.sdrNome) colaboradores.add(venda.sdrNome);
    produtos.add(venda.produtoNome);
  }
  return { colaboradores, produtos };
}

function montarRelatorioDryRun(
  processadas: LinhaProcessada[],
  rejeitadas: LinhaRejeitadaRelatorio[],
  abasProcessadas: string[],
  abasIgnoradas: string[],
): { texto: string; divergencias: ReturnType<typeof reconciliarLinhas>; totaisPorPessoaMes: ReturnType<typeof agregarPorPessoaMes> } {
  const { colaboradores, produtos } = nomesUnicos(processadas);
  const linhas: string[] = [];
  const p = (s: string) => linhas.push(s);

  p("\n=== RELATÓRIO DE VALIDAÇÃO (DRY-RUN) ===\n");
  p(`Gerado em: ${new Date().toISOString()}`);
  p(`Abas processadas (${abasProcessadas.length}): ${abasProcessadas.join(", ")}`);
  p(`Abas FORA de escopo, ignoradas (${abasIgnoradas.length}): ${abasIgnoradas.join(", ")}`);
  p(`\nLinhas de venda válidas: ${processadas.length}`);
  p(`Linhas rejeitadas: ${rejeitadas.length}`);
  p(`Colaboradores distintos detectados (closer/SDR): ${colaboradores.size}`);
  p(`  -> ${Array.from(colaboradores).sort().join(", ")}`);
  p(`Produtos distintos detectados: ${produtos.size}`);
  p(`  -> ${Array.from(produtos).sort().join(", ")}`);

  if (rejeitadas.length > 0) {
    p("\n--- Linhas rejeitadas (motivo) — TODAS, nenhuma descartada silenciosamente ---");
    for (const r of rejeitadas) {
      p(`  [${r.nomeAba} linha ${r.numeroLinha}] ${r.aluno}: ${r.motivo}`);
    }
  }

  const linhasParaReconciliar: LinhaParaReconciliar[] = processadas.map((item) => ({
    numeroLinha: item.numeroLinha,
    nomeAba: item.nomeAba,
    venda: item.venda,
    comissaoCloserPlanilha: item.comissaoCloserPlanilha,
    comissaoSdrPlanilha: item.comissaoSdrPlanilha,
  }));

  const divergencias = reconciliarLinhas(linhasParaReconciliar);
  const totaisPorPessoaMes = agregarPorPessoaMes(linhasParaReconciliar);

  p(`\n--- Reconciliação (recomputado vs. planilha, tolerância R$0,05/linha) ---`);
  p(
    `Linhas com comissão comparável: ${
      linhasParaReconciliar.filter(
        (l) => l.comissaoCloserPlanilha || l.comissaoSdrPlanilha,
      ).length
    }`,
  );
  p(`Divergências acima da tolerância: ${divergencias.length}`);
  if (divergencias.length > 0) {
    p("\n  Divergências linha a linha (TODAS — motivo típico: linha 'Pendente' com comissão pré-calculada na planilha, ou % histórico divergente):");
    for (const d of divergencias) {
      p(
        `    [${d.nomeAba} L${d.numeroLinha}] ${d.papel} ${d.pessoa} (${d.alunoNome}): recomputado=R$${d.recomputado.toFixed(2)} planilha=R$${d.planilha.toFixed(2)} diff=R$${d.diferenca.toFixed(2)}`,
      );
    }
  }

  p(`\n--- Totais recomputados por (mês, pessoa) — ${totaisPorPessoaMes.length} linhas ---`);
  for (const t of totaisPorPessoaMes) {
    const status = Math.abs(t.diferenca) <= 0.05 ? "OK" : "DIVERGE";
    p(
      `  [${status}] ${t.mesReferencia} ${t.papel} ${t.pessoa}: recomputado=R$${t.totalRecomputado.toFixed(2)} planilha=R$${t.totalPlanilha.toFixed(2)} diff=R$${t.diferenca.toFixed(2)} (${t.numeroLinhas} linhas)`,
    );
  }

  const mesesDivergentes = totaisPorPessoaMes.filter(
    (t) => Math.abs(t.diferenca) > 0.05,
  ).length;
  p(
    `\nResumo reconciliação: ${totaisPorPessoaMes.length - mesesDivergentes}/${totaisPorPessoaMes.length} (mês, pessoa) batendo dentro da tolerância.`,
  );

  return { texto: linhas.join("\n"), divergencias, totaisPorPessoaMes };
}

// ------------------------------------------------------------------
// 3) LOAD — upsert idempotente por chave natural.
// ------------------------------------------------------------------

function paraDataUTC(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function emailImportado(nome: string): string {
  const slug = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug}@import.historico.local`;
}

async function upsertColaborador(
  nome: string,
  papel: "CLOSER" | "SDR",
): Promise<string> {
  const email = emailImportado(nome);
  const existente = await db.colaborador.findFirst({
    where: { nome: { equals: nome, mode: "insensitive" } },
  });
  if (existente) return existente.id;

  const criado = await db.colaborador.upsert({
    where: { email },
    update: {},
    create: { nome, email, papel, ativo: true },
  });
  return criado.id;
}

async function upsertProduto(nome: string): Promise<string> {
  const existente = await db.produto.findFirst({
    where: { nome: { equals: nome, mode: "insensitive" } },
  });
  if (existente) return existente.id;

  const criado = await db.produto.create({ data: { nome, ativo: true } });
  return criado.id;
}

// Chave natural da venda (IMPORT-03): aluno + data da venda + valor total.
// CRÍTICO (achado real durante o --apply contra o Neon): a MESMA venda
// aparece repetida em VÁRIAS abas mensais da planilha — cada aba
// "<MÊS>PGTO <MÊS PAGAMENTO>" tem uma linha para aquela venda representando
// o status de pagamento NAQUELE mês específico (ex.: a venda de "Aline" de
// 2025-04-30 aparece em 9 abas diferentes, uma por mês de referência). Por
// isso `upsertVendaComParcelas` recebe o GRUPO INTEIRO de linhas que
// compartilham a chave natural — nunca uma linha isolada — e aplica os
// fatos de pagamento de TODAS elas ao cronograma único gerado a partir da
// PRIMEIRA linha (mesmos dados de TCV/entrada/mensalidade/diaVencimento em
// todas as linhas do grupo, só o mês de referência e o status mudam).
async function upsertVendaComParcelas(
  grupo: LinhaProcessada[],
  closerId: string,
  sdrId: string | null,
  produtoId: string,
) {
  const primeira = grupo[0].venda;

  const existente = await db.venda.findFirst({
    where: {
      alunoNome: primeira.alunoNome,
      dataVenda: paraDataUTC(primeira.dataVenda),
      valorTotal: primeira.valorTotal,
    },
  });

  const cronograma = gerarCronogramaParcelas({
    tipoPagamento: (primeira.tipoPagamento === "A_VISTA"
      ? "a_vista"
      : "mensalista") as TipoPagamentoDominio,
    mesReferenciaInicial: primeira.mesReferencia,
    diaVencimento: primeira.diaVencimento,
    valorTotal: primeira.valorTotal,
    entrada: primeira.entrada,
    valorMensalidade: primeira.valorMensalidade,
    numeroParcelas: primeira.tipoPagamento === "MENSALISTA" ? 12 : 1,
  });

  const dadosVenda: Prisma.VendaUncheckedCreateInput = {
    dataVenda: paraDataUTC(primeira.dataVenda),
    alunoNome: primeira.alunoNome,
    pagadorNome: primeira.pagadorNome,
    plataforma: primeira.plataforma,
    produtoId,
    tipoPagamento: primeira.tipoPagamento,
    valorTotal: primeira.valorTotal,
    entrada: primeira.entrada,
    valorMensalidade: primeira.valorMensalidade,
    numeroParcelas: primeira.tipoPagamento === "MENSALISTA" ? 12 : 1,
    diaVencimento: primeira.diaVencimento,
    mesReferencia: paraDataUTC(primeira.mesReferencia),
    closerId,
    sdrId,
    observacao: primeira.observacao,
  };

  const vendaRow = await db.venda.upsert({
    where: { id: existente?.id ?? "___nunca___" },
    update: dadosVenda,
    create: dadosVenda,
  });

  // Fato de pagamento POR MÊS DE REFERÊNCIA, agregado de TODAS as linhas do
  // grupo (uma linha de planilha por mês em que aquela venda apareceu) —
  // nunca só a última linha processada, que sobrescreveria (perderia) os
  // meses já pagos registrados em linhas anteriores do grupo.
  const fatoPorMes = new Map<
    string,
    { pago: boolean; valorRecebido: number; dataPagamento: string }
  >();
  for (const { venda } of grupo) {
    if (venda.pago) {
      fatoPorMes.set(venda.mesReferencia, {
        pago: true,
        valorRecebido: venda.valorRecebidoNoMes,
        dataPagamento: venda.dataVenda,
      });
    } else if (!fatoPorMes.has(venda.mesReferencia)) {
      fatoPorMes.set(venda.mesReferencia, {
        pago: false,
        valorRecebido: 0,
        dataPagamento: venda.dataVenda,
      });
    }
  }

  // Upserts em paralelo (Promise.all): cada parcela tem uma chave única
  // distinta (vendaId+tipo+numero), então não há conflito de escrita entre
  // elas — paralelizar reduz drasticamente o tempo total contra um banco
  // remoto (Neon) onde cada round-trip sequencial pesa latência de rede.
  await Promise.all(
    cronograma.map((p) => {
      const dadosParcela: Prisma.ParcelaUncheckedCreateInput = {
        vendaId: vendaRow.id,
        tipo: p.tipo,
        numero: p.numero,
        mesReferencia: paraDataUTC(p.mesReferencia),
        dataVencimento: paraDataUTC(p.dataVencimento),
        valorPrevisto: p.valorPrevisto,
      };

      const fato = fatoPorMes.get(p.mesReferencia);
      const statusPagamento = fato?.pago ? "PAGO" : "PENDENTE";
      const valorRecebido = fato?.pago ? fato.valorRecebido : null;
      const dataPagamento = fato?.pago ? paraDataUTC(fato.dataPagamento) : null;

      return db.parcela.upsert({
        where: {
          vendaId_tipo_numero: { vendaId: vendaRow.id, tipo: p.tipo, numero: p.numero },
        },
        update: { ...dadosParcela, statusPagamento, valorRecebido, dataPagamento },
        create: { ...dadosParcela, statusPagamento, valorRecebido, dataPagamento },
      });
    }),
  );

  return vendaRow.id;
}

// Garante um PlanoComissao "percentual_fixo" vigente para o colaborador
// importado, usando o % mais FREQUENTE observado nas linhas históricas
// dele (best-effort — plano histórico real variava por venda; este plano
// serve apenas como referência vigente daqui para frente, nunca é usado
// para recalcular o snapshot histórico em si, que usa o % de CADA linha).
async function garantirPlanoVigente(
  colaboradorId: string,
  percentualMaisFrequente: number,
  vigenciaInicio: string,
) {
  const existente = await db.planoComissao.findFirst({
    where: { colaboradorId, vigenciaFim: null },
  });
  if (existente) return;

  await db.planoComissao.create({
    data: {
      colaboradorId,
      tipo: "percentual_fixo",
      config: { percentual: percentualMaisFrequente },
      vigenciaInicio: paraDataUTC(vigenciaInicio),
      vigenciaFim: null,
    },
  });
}

function mesSeguinte(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, 1));
  data.setUTCMonth(data.getUTCMonth() + 1);
  const anoSeguinte = data.getUTCFullYear();
  const mesSeguinteStr = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${anoSeguinte}-${mesSeguinteStr}-01`;
}

// Grava o snapshot de ComissaoApurada por (colaborador, mês) a partir do
// total RECOMPUTADO (não copiado da planilha) — mesma tabela/estrutura que
// o motor ao vivo (apuracao.service.ts) grava, para que o histórico
// apareça nas MESMAS telas usadas para dados cadastrados manualmente
// (critério de sucesso #1 da Fase 10).
async function upsertApuracaoHistorica(
  colaboradorId: string,
  mesReferencia: string,
  planoComissaoId: string,
  valorBase: number,
  percentualAplicado: number | null,
  valorComissao: number,
) {
  const mesReferenciaData = paraDataUTC(mesReferencia);

  await db.comissaoApurada.upsert({
    where: {
      colaboradorId_mesReferencia: { colaboradorId, mesReferencia: mesReferenciaData },
    },
    update: {
      mesPagamento: paraDataUTC(mesSeguinte(mesReferencia)),
      planoComissaoId,
      tipoPlano: "percentual_fixo",
      valorBase,
      percentualAplicado,
      valorComissao,
      inputSnapshot: {
        origem: "importacao-historico",
        mesReferencia,
        valorBase,
        percentualAplicado,
      },
      calculadoEm: new Date(),
      calculadoPor: null,
    },
    create: {
      colaboradorId,
      mesReferencia: mesReferenciaData,
      mesPagamento: paraDataUTC(mesSeguinte(mesReferencia)),
      planoComissaoId,
      tipoPlano: "percentual_fixo",
      valorBase,
      percentualAplicado,
      valorComissao,
      inputSnapshot: {
        origem: "importacao-historico",
        mesReferencia,
        valorBase,
        percentualAplicado,
      },
      calculadoEm: new Date(),
      calculadoPor: null,
    },
  });
}

function percentualMaisFrequente(valores: number[]): number {
  const contagem = new Map<number, number>();
  for (const v of valores) {
    contagem.set(v, (contagem.get(v) ?? 0) + 1);
  }
  let melhor = valores[0] ?? 0;
  let melhorContagem = 0;
  for (const [valor, count] of contagem) {
    if (count > melhorContagem) {
      melhor = valor;
      melhorContagem = count;
    }
  }
  return melhor;
}

async function aplicarImportacao(processadas: LinhaProcessada[]) {
  const { colaboradores, produtos } = nomesUnicos(processadas);

  console.log(`\n=== APLICANDO IMPORTAÇÃO (--apply) ===\n`);

  // 1) Produtos.
  const produtoIdPorNome = new Map<string, string>();
  for (const nome of produtos) {
    produtoIdPorNome.set(nome, await upsertProduto(nome));
  }
  console.log(`Produtos upsertados: ${produtoIdPorNome.size}`);

  // 2) Colaboradores — papel inferido: aparece como CLOSER em alguma linha
  // => CLOSER; senão (só aparece como SDR) => SDR.
  const papelPorNome = new Map<string, "CLOSER" | "SDR">();
  for (const { venda } of processadas) {
    if (venda.closerNome) papelPorNome.set(venda.closerNome, "CLOSER");
  }
  for (const { venda } of processadas) {
    if (venda.sdrNome && !papelPorNome.has(venda.sdrNome)) {
      papelPorNome.set(venda.sdrNome, "SDR");
    }
  }

  const colaboradorIdPorNome = new Map<string, string>();
  for (const nome of colaboradores) {
    const papel = papelPorNome.get(nome) ?? "CLOSER";
    colaboradorIdPorNome.set(nome, await upsertColaborador(nome, papel));
  }
  console.log(`Colaboradores upsertados: ${colaboradorIdPorNome.size}`);

  // 3) Vendas + parcelas — AGRUPADAS por chave natural primeiro (achado real
  // durante o --apply: a mesma venda aparece repetida em várias abas
  // mensais, uma linha por mês em que teve movimento de pagamento — ver
  // comentário de upsertVendaComParcelas). Processar linha a linha
  // independentemente faria a última linha processada sobrescrever/perder
  // os meses pagos registrados pelas linhas anteriores do mesmo grupo.
  function chaveNatural(venda: VendaNormalizada): string {
    return `${venda.alunoNome}|${venda.dataVenda}|${venda.valorTotal}`;
  }

  const gruposPorChave = new Map<string, LinhaProcessada[]>();
  for (const item of processadas) {
    const chave = chaveNatural(item.venda);
    const lista = gruposPorChave.get(chave) ?? [];
    lista.push(item);
    gruposPorChave.set(chave, lista);
  }
  const grupos = Array.from(gruposPorChave.values());

  let vendasCriadas = 0;
  let vendasPuladas = 0;
  const totalGrupos = grupos.length;
  const TAMANHO_LOTE = 10;

  for (let inicio = 0; inicio < grupos.length; inicio += TAMANHO_LOTE) {
    const lote = grupos.slice(inicio, inicio + TAMANHO_LOTE);

    await Promise.all(
      lote.map(async (grupo) => {
        // closer/sdr/produto: usa a linha mais informativa do grupo (a
        // primeira que tiver closerNome definido) — algumas linhas do mesmo
        // grupo têm CLOSER "-" em meses em que a venda não teve movimento.
        const linhaComCloser = grupo.find((g) => g.venda.closerNome) ?? grupo[0];
        const venda = linhaComCloser.venda;

        const closerId = venda.closerNome
          ? colaboradorIdPorNome.get(venda.closerNome)!
          : null;
        const sdrId = venda.sdrNome
          ? colaboradorIdPorNome.get(venda.sdrNome)!
          : null;
        const produtoId = produtoIdPorNome.get(venda.produtoNome)!;

        // Venda sem closer identificável em NENHUMA linha do grupo: usar o
        // primeiro colaborador CLOSER conhecido como titular técnico seria
        // incorreto — em vez disso, pula a materialização de VENDA (mantém
        // apenas no relatório) porque `Venda.closerId` é obrigatório no
        // schema e inventar um titular seria pior que não importar a linha.
        if (!closerId) {
          vendasPuladas += 1;
          return;
        }

        try {
          await upsertVendaComParcelas(grupo, closerId, sdrId, produtoId);
          vendasCriadas += 1;
        } catch (err) {
          console.error(
            `  [ERRO] venda [${linhaComCloser.nomeAba} L${linhaComCloser.numeroLinha}] ${venda.alunoNome} — ${(err as Error).message}`,
          );
        }
      }),
    );

    const processado = Math.min(inicio + TAMANHO_LOTE, totalGrupos);
    console.log(
      `  ...progresso venda ${processado}/${totalGrupos} (criadas=${vendasCriadas}, puladas=${vendasPuladas})`,
    );
  }
  console.log(`Vendas (+ parcelas) upsertadas: ${vendasCriadas} (puladas sem closer: ${vendasPuladas})`);

  // 4) Plano vigente best-effort por colaborador (para telas futuras).
  const percentuaisPorColaborador = new Map<string, number[]>();
  for (const { venda } of processadas) {
    if (venda.closerNome && venda.percentualCloser !== null) {
      const lista = percentuaisPorColaborador.get(venda.closerNome) ?? [];
      lista.push(venda.percentualCloser);
      percentuaisPorColaborador.set(venda.closerNome, lista);
    }
    if (venda.sdrNome && venda.percentualSdr !== null) {
      const lista = percentuaisPorColaborador.get(venda.sdrNome) ?? [];
      lista.push(venda.percentualSdr);
      percentuaisPorColaborador.set(venda.sdrNome, lista);
    }
  }

  const planoIdPorColaborador = new Map<string, string>();
  for (const [nome, colaboradorId] of colaboradorIdPorNome) {
    const percentuais = percentuaisPorColaborador.get(nome) ?? [0.03];
    await garantirPlanoVigente(
      colaboradorId,
      percentualMaisFrequente(percentuais),
      "2025-01-01",
    );
    const plano = await db.planoComissao.findFirst({
      where: { colaboradorId, vigenciaFim: null },
    });
    if (plano) planoIdPorColaborador.set(colaboradorId, plano.id);
  }

  // 5) Snapshot de comissão apurada por (colaborador, mês), RECOMPUTADO a
  // partir das linhas (não copiado da planilha) — IMPORT-02.
  const linhasParaReconciliar: LinhaParaReconciliar[] = processadas.map((p) => ({
    numeroLinha: p.numeroLinha,
    nomeAba: p.nomeAba,
    venda: p.venda,
    comissaoCloserPlanilha: p.comissaoCloserPlanilha,
    comissaoSdrPlanilha: p.comissaoSdrPlanilha,
  }));
  const totaisPorPessoaMes = agregarPorPessoaMes(linhasParaReconciliar);

  let apuracoesGravadas = 0;
  for (const total of totaisPorPessoaMes) {
    const colaboradorId = colaboradorIdPorNome.get(total.pessoa);
    const planoComissaoId = colaboradorId
      ? planoIdPorColaborador.get(colaboradorId)
      : undefined;
    if (!colaboradorId || !planoComissaoId) continue;

    // percentualAplicado do snapshot: percentual médio efetivo implícito no
    // total (comissão recomputada / valor base), não um valor inventado.
    const valorBaseTotal = linhasParaReconciliar
      .filter(
        (l) =>
          l.venda.mesReferencia === total.mesReferencia &&
          ((total.papel === "CLOSER" && l.venda.closerNome === total.pessoa) ||
            (total.papel === "SDR" && l.venda.sdrNome === total.pessoa)),
      )
      .reduce((acc, l) => acc + l.venda.valorRecebidoNoMes, 0);

    const percentualAplicado =
      valorBaseTotal > 0
        ? arredondar(toDecimal(total.totalRecomputado).div(valorBaseTotal))
        : null;

    await upsertApuracaoHistorica(
      colaboradorId,
      total.mesReferencia,
      planoComissaoId,
      valorBaseTotal,
      percentualAplicado,
      total.totalRecomputado,
    );
    apuracoesGravadas += 1;
  }
  console.log(`Apurações históricas (comissao_apurada) gravadas: ${apuracoesGravadas}`);

  return { vendasCriadas, apuracoesGravadas, colaboradores: colaboradorIdPorNome.size, produtos: produtoIdPorNome.size };
}

// ------------------------------------------------------------------
// MAIN
// ------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const aplicar = args.includes("--apply");
  const idxArquivo = args.indexOf("--arquivo");
  const nomeArquivo =
    idxArquivo >= 0 && args[idxArquivo + 1] ? args[idxArquivo + 1] : ARQUIVO_PADRAO;
  const caminhoArquivo = path.resolve(process.cwd(), nomeArquivo);

  console.log(`Lendo planilha: ${caminhoArquivo}`);
  console.log(`Modo: ${aplicar ? "APLICAR (grava no banco)" : "DRY-RUN (não grava nada)"}`);

  const { processadas, rejeitadas, abasProcessadas, abasIgnoradas } =
    extrairEnormalizar(caminhoArquivo);

  const { texto: relatorio } = montarRelatorioDryRun(
    processadas,
    rejeitadas,
    abasProcessadas,
    abasIgnoradas,
  );
  console.log(relatorio);

  // Relatório contém PII (nomes de alunos/colaboradores) — grava SEMPRE em
  // import/.output/ (gitignored, ver .gitignore), NUNCA no repositório.
  const fs = await import("node:fs");
  const dirRelatorio = path.resolve(process.cwd(), "import/.output");
  fs.mkdirSync(dirRelatorio, { recursive: true });
  const caminhoRelatorio = path.join(
    dirRelatorio,
    `relatorio-importacao-${aplicar ? "apply" : "dryrun"}-${Date.now()}.txt`,
  );
  fs.writeFileSync(caminhoRelatorio, relatorio, "utf-8");
  console.log(`\nRelatório completo salvo em: ${caminhoRelatorio} (gitignored, contém PII)`);

  if (!aplicar) {
    console.log(
      "\nDry-run concluído. Nenhuma escrita foi feita. Rode com --apply para gravar.",
    );
    return;
  }

  const resumo = await aplicarImportacao(processadas);

  console.log("\n=== RESUMO FINAL ===");
  console.log(JSON.stringify(resumo, null, 2));
}

main()
  .catch((err) => {
    console.error("\nERRO FATAL na importação:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
