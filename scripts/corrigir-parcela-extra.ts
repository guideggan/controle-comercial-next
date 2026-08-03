#!/usr/bin/env -S npx tsx
// ============================================================
// CORREÇÃO — vendas com uma parcela a mais que o contrato (bug B1)
// ============================================================
// Encontrado na varredura de 2026-08-02. A importação da Fase 10 tratou a
// PRIMEIRA MENSALIDADE de alguns contratos como se fosse uma "entrada"
// separada, E manteve o número cheio de mensalidades. Resultado: 13 parcelas
// num contrato de 12.
//
//   Contrato de R$ 15.000 em 12x de R$ 1.250
//   Gravado como: entrada R$ 1.250 + 12 mensalidades de R$ 1.250 = R$ 16.250
//   Correto:      entrada R$ 1.250 + 11 mensalidades de R$ 1.250 = R$ 15.000
//
// Identificação (as três condições precisam ser verdadeiras juntas, para não
// pegar contrato que legitimamente tem entrada igual à mensalidade):
//   1. tipoPagamento = MENSALISTA
//   2. entrada == valorMensalidade
//   3. entrada + (valorMensalidade × numeroParcelas) == valorTotal + valorMensalidade
//
// A correção remove a ÚLTIMA mensalidade (a excedente) e decrementa
// numeroParcelas. NUNCA remove parcela PAGA: se a última estiver paga, a
// venda é pulada e reportada para conferência manual — pode ser que o
// contrato realmente tenha 13 pagamentos e o TCV é que esteja errado.
//
// Uso:
//   npx tsx scripts/corrigir-parcela-extra.ts            (dry-run)
//   npx tsx scripts/corrigir-parcela-extra.ts --apply    (grava)

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APLICAR = process.argv.includes("--apply");

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function main() {
  console.log("=".repeat(70));
  console.log(
    `CORREÇÃO DE PARCELA EXTRA — ${APLICAR ? "APLICANDO" : "DRY-RUN (nada será gravado)"}`,
  );
  console.log("=".repeat(70));

  const vendas = await db.venda.findMany({
    where: { tipoPagamento: "MENSALISTA" },
    include: {
      parcelas: { orderBy: [{ tipo: "asc" }, { numero: "asc" }] },
    },
  });

  let corrigidas = 0;
  let puladas = 0;
  let valorRemovido = 0;

  for (const venda of vendas) {
    const entrada = Number(venda.entrada);
    const mensalidade = Number(venda.valorMensalidade);
    const tcv = Number(venda.valorTotal);

    if (entrada <= 0 || mensalidade <= 0) continue;
    if (Math.abs(entrada - mensalidade) > 0.01) continue;

    const soma = entrada + mensalidade * venda.numeroParcelas;
    if (Math.abs(soma - tcv - mensalidade) > 1) continue;

    const mensalidades = venda.parcelas.filter((p) => p.tipo === "MENSALIDADE");
    const ultima = mensalidades[mensalidades.length - 1];

    if (!ultima) {
      console.log(`  PULADA ${venda.alunoNome}: sem mensalidade para remover.`);
      puladas += 1;
      continue;
    }

    // NUNCA apaga parcela paga. Se a última já foi recebida, o contrato pode
    // realmente ter 13 pagamentos — decisão humana, não do script.
    if (ultima.statusPagamento === "PAGO") {
      console.log(
        `  PULADA ${venda.alunoNome}: a última mensalidade (${ultima.numero}) está PAGA ` +
          `(${brl(Number(ultima.valorRecebido ?? 0))}). Conferir manualmente.`,
      );
      puladas += 1;
      continue;
    }

    // Trava adicional: venda de mês fechado não é tocada sem reabertura
    // explícita (COMIS-06).
    if (venda.fechado) {
      console.log(
        `  PULADA ${venda.alunoNome}: venda de mês FECHADO. Reabrir a apuração antes.`,
      );
      puladas += 1;
      continue;
    }

    console.log(
      `  ${venda.alunoNome}: TCV ${brl(tcv)} = ${Math.round(tcv / mensalidade)}x ${brl(mensalidade)} | ` +
        `${venda.parcelas.length} parcelas -> ${venda.parcelas.length - 1} ` +
        `(remove mensalidade nº ${ultima.numero})`,
    );

    valorRemovido += Number(ultima.valorPrevisto);
    corrigidas += 1;

    if (APLICAR) {
      await db.$transaction(async (tx) => {
        await tx.parcela.delete({ where: { id: ultima.id } });
        await tx.venda.update({
          where: { id: venda.id },
          data: { numeroParcelas: venda.numeroParcelas - 1 },
        });
        await tx.auditLog.create({
          data: {
            acao: "EDITAR_VENDA",
            entidade: "venda",
            entidadeId: venda.id,
            dadosAntes: {
              numeroParcelas: venda.numeroParcelas,
              totalParcelas: venda.parcelas.length,
            },
            dadosDepois: {
              numeroParcelas: venda.numeroParcelas - 1,
              totalParcelas: venda.parcelas.length - 1,
              motivo:
                "Correção do bug B1: 1ª mensalidade contada também como entrada na importação da Fase 10",
              parcelaRemovida: {
                id: ultima.id,
                numero: ultima.numero,
                valorPrevisto: Number(ultima.valorPrevisto),
              },
            },
          },
        });
      });
    }
  }

  console.log("\n" + "-".repeat(70));
  console.log(`Vendas corrigidas ........ ${corrigidas}`);
  console.log(`Vendas puladas ........... ${puladas}`);
  console.log(`Valor previsto removido .. ${brl(valorRemovido)}`);

  if (!APLICAR) {
    console.log("\nDRY-RUN: nada foi gravado. Rode com --apply para aplicar.");
  } else {
    console.log("\nCada correção ficou registrada em audit_log (acao=EDITAR_VENDA).");
  }
}

main()
  .catch((erro) => {
    console.error("FALHOU:", erro);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
