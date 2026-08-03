#!/usr/bin/env -S npx tsx
// ============================================================
// BACKFILL DE COMPONENTES DE PAGAMENTO (Fase 11 / PGMT-07)
// ============================================================
// Converte as vendas que existem hoje no banco (261 históricas da Fase 10 +
// as lançadas manualmente) do formato escalar do v1
// (entrada/valorMensalidade/numeroParcelas) para o plano de pagamento
// estruturado da Fase 11 (ComponentePagamento).
//
// GARANTIA CENTRAL (critério de aceite 6 da fase):
//   NENHUMA PARCELA É CRIADA, APAGADA OU TEM VALOR ALTERADO.
// O script só (a) cria linhas em `componente_pagamento` e (b) preenche
// `parcela.componenteId`. Como `recebidoNoMes` — e portanto toda a comissão
// já apurada — depende exclusivamente de valor/status/competência das
// parcelas, nada do que já foi apurado ou fechado pode mudar.
//
// IDEMPOTENTE: a chave natural é (vendaId, ordem). Vendas que já têm
// componentes são puladas. Rodar duas vezes produz o mesmo estado.
//
// A POLÍTICA DE 50% NÃO É APLICADA AQUI (PGMT-05 vale só para venda nova):
// vendas anteriores à política — como Vanessa Militani, 100% recorrência em
// julho/2026 — precisam continuar existindo exatamente como estão.
//
// Uso:
//   npx tsx scripts/backfill-componentes.ts            (dry-run, não grava)
//   npx tsx scripts/backfill-componentes.ts --apply    (grava)
//   npx tsx scripts/backfill-componentes.ts --apply --venda=<id>   (uma venda)

import { PrismaClient, type FormaPagamento } from "@prisma/client";

const db = new PrismaClient();

const APLICAR = process.argv.includes("--apply");
const VENDA_ALVO = process.argv
  .find((a) => a.startsWith("--venda="))
  ?.split("=")[1];

function paraDataUTC(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function dataParaString(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(data.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function mesDaData(data: string): string {
  const [ano, mes] = data.split("-");
  return `${ano}-${mes}-01`;
}

function brl(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ============================================================
// HEURÍSTICA DE FORMA DE PAGAMENTO
// ============================================================
// O v1 nunca guardou a forma de pagamento de forma estruturada — ela só
// existe no texto livre de `observacao`, copiado do grupo de WhatsApp. A
// conversão infere a forma a partir desse texto.
//
// IMPORTANTE: a forma inferida NÃO afeta o valor presente. O que afeta é
// `contaCheioNoMes`, e esse vem do BLOCO (entrada vs mensalidade), não da
// heurística. A forma influencia apenas o relatório de composição (FATUR-06:
// "quanto foi PIX, quanto foi cartão"). Por isso errar aqui é cosmético, e
// toda inferência fica marcada na `descricao` do componente para conferência.

const PADROES_FORMA: Array<{ regex: RegExp; forma: FormaPagamento }> = [
  { regex: /\bpix\b/i, forma: "PIX" },
  { regex: /\bcart(ã|a)o\b|\bcredito\b|\bcrédito\b|\d+\s*x\b/i, forma: "CARTAO_PARCELADO" },
  { regex: /\bboleto\b|\bcarn(ê|e)\b/i, forma: "BOLETO" },
  { regex: /\bsinal\b|\bentrada\b/i, forma: "SINAL" },
];

function inferirFormaDaEntrada(observacao: string | null, parcelas: number) {
  const texto = observacao ?? "";
  for (const { regex, forma } of PADROES_FORMA) {
    if (regex.test(texto)) return { forma, inferida: true };
  }
  // Sem pista no texto: parcelado presume cartão, à vista presume PIX.
  return {
    forma: (parcelas > 1 ? "CARTAO_PARCELADO" : "PIX") as FormaPagamento,
    inferida: false,
  };
}

type ComponentePlanejado = {
  ordem: number;
  forma: FormaPagamento;
  contaCheioNoMes: boolean;
  valor: number;
  parcelas: number;
  dataPrevista: string;
  descricao: string;
  /** Tipos de parcela existentes que devem ser vinculados a este componente. */
  vinculaTipos: Array<"ENTRADA" | "MENSALIDADE" | "AVISTA">;
};

/**
 * Traduz uma venda do formato v1 para componentes.
 *
 * A_VISTA          → 1 componente que conta cheio (valor = TCV)
 * MENSALISTA c/ entrada → componente de entrada (conta cheio)
 *                          + componente de recorrência (não conta cheio)
 * MENSALISTA s/ entrada → só o componente de recorrência
 *
 * `contaCheioNoMes` vem do BLOCO, nunca da forma inferida — é o que preserva
 * o valor presente da conversão fiel ao que a planilha apurava.
 */
function planejarComponentes(venda: {
  id: string;
  tipoPagamento: string;
  valorTotal: number;
  entrada: number;
  valorMensalidade: number;
  numeroParcelas: number;
  diaVencimento: number;
  mesReferencia: string;
  observacao: string | null;
}): ComponentePlanejado[] {
  const componentes: ComponentePlanejado[] = [];
  const diaAncora = String(Math.min(venda.diaVencimento, 28)).padStart(2, "0");
  const dataInicial = `${venda.mesReferencia.slice(0, 7)}-${diaAncora}`;

  if (venda.tipoPagamento === "A_VISTA") {
    const { forma, inferida } = inferirFormaDaEntrada(
      venda.observacao,
      venda.numeroParcelas,
    );
    componentes.push({
      ordem: 0,
      forma,
      contaCheioNoMes: true,
      valor: venda.valorTotal,
      parcelas: Math.max(1, venda.numeroParcelas),
      dataPrevista: dataInicial,
      descricao: descricaoConversao(inferida, forma),
      vinculaTipos: ["AVISTA"],
    });
    return componentes;
  }

  // MENSALISTA
  let ordem = 0;

  if (venda.entrada > 0) {
    const { forma, inferida } = inferirFormaDaEntrada(venda.observacao, 1);
    componentes.push({
      ordem: ordem++,
      forma,
      contaCheioNoMes: true,
      valor: venda.entrada,
      parcelas: 1,
      dataPrevista: dataInicial,
      descricao: descricaoConversao(inferida, forma),
      vinculaTipos: ["ENTRADA", "AVISTA"],
    });
  }

  const totalRecorrencia = venda.valorMensalidade * venda.numeroParcelas;
  if (totalRecorrencia > 0) {
    // A recorrência começa no mês seguinte quando há entrada (regra do
    // cronograma do v1, src/domain/vendas/parcelas.ts) — preservada aqui.
    const mesInicial =
      venda.entrada > 0
        ? proximoMesDe(venda.mesReferencia)
        : venda.mesReferencia;
    componentes.push({
      ordem: ordem++,
      forma: "RECORRENCIA",
      contaCheioNoMes: false,
      valor: totalRecorrencia,
      parcelas: venda.numeroParcelas,
      dataPrevista: `${mesInicial.slice(0, 7)}-${diaAncora}`,
      descricao: "Convertido automaticamente do formato v1 (recorrência).",
      vinculaTipos: ["MENSALIDADE"],
    });
  }

  return componentes;
}

function descricaoConversao(inferida: boolean, forma: FormaPagamento): string {
  return inferida
    ? `Convertido do formato v1. Forma "${forma}" inferida da observação — conferir.`
    : `Convertido do formato v1. Forma "${forma}" PRESUMIDA (sem pista na observação) — conferir.`;
}

function proximoMesDe(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes, 1));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

async function main() {
  console.log("=".repeat(70));
  console.log(
    `BACKFILL DE COMPONENTES — ${APLICAR ? "APLICANDO" : "DRY-RUN (nada será gravado)"}`,
  );
  console.log("=".repeat(70));

  const vendas = await db.venda.findMany({
    where: {
      ...(VENDA_ALVO ? { id: VENDA_ALVO } : {}),
      componentes: { none: {} }, // idempotência: pula quem já foi convertido
    },
    include: {
      parcelas: { select: { id: true, tipo: true, valorPrevisto: true, statusPagamento: true } },
      _count: { select: { componentes: true } },
    },
    orderBy: { dataVenda: "asc" },
  });

  const jaConvertidas = await db.venda.count({
    where: { componentes: { some: {} } },
  });

  console.log(`\nVendas a converter: ${vendas.length}`);
  console.log(`Vendas já convertidas (puladas): ${jaConvertidas}\n`);

  let convertidas = 0;
  let parcelasVinculadas = 0;
  let formaPresumida = 0;
  const divergencias: string[] = [];

  for (const venda of vendas) {
    const planejados = planejarComponentes({
      id: venda.id,
      tipoPagamento: venda.tipoPagamento,
      valorTotal: Number(venda.valorTotal),
      entrada: Number(venda.entrada),
      valorMensalidade: Number(venda.valorMensalidade),
      numeroParcelas: venda.numeroParcelas,
      diaVencimento: venda.diaVencimento,
      mesReferencia: dataParaString(venda.mesReferencia),
      observacao: venda.observacao,
    });

    if (planejados.length === 0) {
      divergencias.push(
        `${venda.id} (${venda.alunoNome}): nenhum componente derivável — ` +
          `TCV ${brl(Number(venda.valorTotal))}, entrada ${brl(Number(venda.entrada))}, ` +
          `mensalidade ${brl(Number(venda.valorMensalidade))}. PULADA.`,
      );
      continue;
    }

    // RECONCILIAÇÃO: a soma dos componentes tem que fechar o TCV da venda.
    // Divergência aqui quase sempre é dado inconsistente vindo da planilha
    // (ex.: valorTotal que não bate com entrada + mensalidade × parcelas) —
    // registrada, nunca silenciada.
    const somaComponentes = planejados.reduce((t, c) => t + c.valor, 0);
    const tcv = Number(venda.valorTotal);
    if (Math.abs(somaComponentes - tcv) > 0.01) {
      divergencias.push(
        `${venda.id} (${venda.alunoNome}): soma dos componentes ${brl(somaComponentes)} ` +
          `≠ TCV ${brl(tcv)} (diferença ${brl(somaComponentes - tcv)}).`,
      );
    }

    if (planejados.some((c) => c.descricao.includes("PRESUMIDA"))) {
      formaPresumida += 1;
    }

    if (!APLICAR) {
      convertidas += 1;
      if (convertidas <= 5) {
        console.log(`  ${venda.alunoNome} (${venda.tipoPagamento}) — TCV ${brl(tcv)}`);
        for (const c of planejados) {
          console.log(
            `      [${c.ordem}] ${c.forma.padEnd(17)} ${brl(c.valor).padStart(14)} ` +
              `× ${String(c.parcelas).padStart(2)} em ${c.dataPrevista} ` +
              `| conta cheio: ${c.contaCheioNoMes ? "SIM" : "não"}`,
          );
        }
      }
      continue;
    }

    await db.$transaction(async (tx) => {
      for (const planejado of planejados) {
        const componente = await tx.componentePagamento.create({
          data: {
            vendaId: venda.id,
            ordem: planejado.ordem,
            forma: planejado.forma,
            contaCheioNoMes: planejado.contaCheioNoMes,
            valor: planejado.valor,
            parcelas: planejado.parcelas,
            dataPrevista: paraDataUTC(planejado.dataPrevista),
            mesPrevisto: paraDataUTC(mesDaData(planejado.dataPrevista)),
            descricao: planejado.descricao,
          },
          select: { id: true },
        });

        // Vincula as parcelas JÁ EXISTENTES ao componente. Nenhum valor,
        // status ou competência é tocado — só a FK.
        const alvo = venda.parcelas.filter((p) =>
          planejado.vinculaTipos.includes(p.tipo),
        );
        if (alvo.length > 0) {
          const resultado = await tx.parcela.updateMany({
            where: { id: { in: alvo.map((p) => p.id) }, componenteId: null },
            data: { componenteId: componente.id },
          });
          parcelasVinculadas += resultado.count;
        }
      }
    });

    convertidas += 1;
  }

  console.log("\n" + "-".repeat(70));
  console.log(`Vendas convertidas ....... ${convertidas}`);
  if (APLICAR) {
    console.log(`Parcelas vinculadas ...... ${parcelasVinculadas}`);
  }
  console.log(`Forma de pagamento presumida (sem pista no texto): ${formaPresumida}`);
  console.log(`Divergências ............. ${divergencias.length}`);

  if (divergencias.length > 0) {
    console.log("\nDIVERGÊNCIAS (conferir manualmente):");
    for (const d of divergencias.slice(0, 30)) console.log(`  - ${d}`);
    if (divergencias.length > 30) {
      console.log(`  ... e mais ${divergencias.length - 30}.`);
    }
  }

  if (!APLICAR) {
    console.log("\nDRY-RUN: nada foi gravado. Rode com --apply para aplicar.");
  }
}

main()
  .catch((erro) => {
    console.error("FALHOU:", erro);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
