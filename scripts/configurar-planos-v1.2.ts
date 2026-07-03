#!/usr/bin/env -S npx tsx
// ============================================================
// CONFIGURAÇÃO DE PLANOS v1.2 — Roberta (Closer Pleno) e Yuri (progressivo)
// + ajuste de meta de Pedro/Douglas/Roberta para R$ 233.000
// ============================================================
// Script standalone (tsx, PrismaClient direto contra o Neon — mesmo padrão de
// scripts/definir-plano-closer-jr.ts), IDEMPOTENTE:
//   - Meta: garante valorMeta = 233000 (VALOR) para Pedro, Douglas, Roberta.
//   - Roberta: plano `salario_bonus_atingimento` (salário R$5.000 + faixas OTE Pleno).
//   - Yuri:   plano `progressivo_atingimento` (0%→2% / 60%→2,5% / 100%→3%).
// Versionamento por vigência: fecha o plano aberto (vigenciaFim = dia anterior)
// e cria a nova linha aberta, em uma transação — igual ao service da aplicação.
//
// Uso:
//   npx tsx scripts/configurar-planos-v1.2.ts            (dry-run)
//   npx tsx scripts/configurar-planos-v1.2.ts --apply     (grava no banco)

import { PrismaClient, type PlanoTipo, type Prisma } from "@prisma/client";

const db = new PrismaClient();

const VIGENCIA_INICIO = "2026-07-01";
const META_CLOSERS = 233000;
const NOMES_META_233 = ["Pedro", "Douglas", "Roberta"];

// Roberta — Closer Pleno OTE: salário fixo R$5.000 + bônus por faixa (R$ fixos)
const PLANO_ROBERTA = {
  tipo: "salario_bonus_atingimento" as PlanoTipo,
  config: {
    salarioFixo: 5000,
    faixas: [
      { minAtingimento: 0, bonus: 0 },
      { minAtingimento: 71, bonus: 2000 },
      { minAtingimento: 86, bonus: 3750 },
      { minAtingimento: 100, bonus: 5000 },
      { minAtingimento: 120, bonus: 7500 },
      { minAtingimento: 150, bonus: 10000 },
      { minAtingimento: 200, bonus: 15000 },
    ],
  } as Prisma.InputJsonValue,
};

// Yuri — progressivo em % do recebido, por faixa de atingimento (frações:
// deAtingimento e percentual são frações, 0.60 = 60%, 0.025 = 2,5%).
const PLANO_YURI = {
  tipo: "progressivo_atingimento" as PlanoTipo,
  config: {
    faixas: [
      { deAtingimento: 0, percentual: 0.02 },
      { deAtingimento: 0.6, percentual: 0.025 },
      { deAtingimento: 1.0, percentual: 0.03 },
    ],
  } as Prisma.InputJsonValue,
};

const PLANOS_ALVO: Record<string, { tipo: PlanoTipo; config: Prisma.InputJsonValue }> = {
  Roberta: PLANO_ROBERTA,
  Yuri: PLANO_YURI,
};

function normalizar(nome: string): string {
  return nome.trim().toLowerCase();
}
function paraDataUTC(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}
function diaAnterior(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function canonicalizar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(canonicalizar);
  if (valor !== null && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonicalizar(v)]),
    );
  }
  return valor;
}
function configsIguais(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalizar(a)) === JSON.stringify(canonicalizar(b));
}

async function ajustarMetas(aplicar: boolean, log: string[]) {
  log.push(`\n=== METAS → R$${META_CLOSERS} (competência ${VIGENCIA_INICIO}) ===`);
  const colaboradores = await db.colaborador.findMany({
    where: { ativo: true, nome: { in: NOMES_META_233 } },
  });
  for (const c of colaboradores) {
    const meta = await db.meta.findUnique({
      where: {
        colaboradorId_mesReferencia: {
          colaboradorId: c.id,
          mesReferencia: paraDataUTC(VIGENCIA_INICIO),
        },
      },
    });
    if (!meta) {
      log.push(`  [criar] ${c.nome}: meta VALOR = R$${META_CLOSERS}`);
      if (aplicar) {
        await db.meta.create({
          data: {
            colaboradorId: c.id,
            mesReferencia: paraDataUTC(VIGENCIA_INICIO),
            unidade: "VALOR",
            valorMeta: META_CLOSERS,
          },
        });
      }
    } else if (Number(meta.valorMeta) !== META_CLOSERS) {
      log.push(`  [ajustar] ${c.nome}: R$${meta.valorMeta} → R$${META_CLOSERS}`);
      if (aplicar) {
        await db.meta.update({
          where: { id: meta.id },
          data: { unidade: "VALOR", valorMeta: META_CLOSERS },
        });
      }
    } else {
      log.push(`  [manter] ${c.nome}: meta já é R$${META_CLOSERS}`);
    }
  }
}

async function definirPlano(nome: string, aplicar: boolean, log: string[]) {
  const alvo = PLANOS_ALVO[nome];
  const colaborador = await db.colaborador.findFirst({
    where: { ativo: true, nome: { equals: nome, mode: "insensitive" } },
  });
  if (!colaborador) {
    log.push(`  [ERRO] "${nome}" não encontrado — plano NÃO definido`);
    return;
  }
  if (colaborador.papel !== "CLOSER") {
    log.push(`  [ERRO] "${nome}" não é CLOSER (papel=${colaborador.papel}) — plano NÃO definido`);
    return;
  }
  const planoAberto = await db.planoComissao.findFirst({
    where: { colaboradorId: colaborador.id, vigenciaFim: null },
  });
  if (planoAberto && planoAberto.tipo === alvo.tipo && configsIguais(planoAberto.config, alvo.config)) {
    log.push(`  [manter] ${nome}: já tem o plano ${alvo.tipo} vigente (id=${planoAberto.id})`);
    return;
  }
  log.push(
    `  [definir] ${nome}: ${alvo.tipo}, vigência a partir de ${VIGENCIA_INICIO}` +
      (planoAberto ? ` (fechando "${planoAberto.tipo}" id=${planoAberto.id})` : ""),
  );
  if (aplicar) {
    await db.$transaction(async (tx) => {
      if (planoAberto) {
        await tx.planoComissao.update({
          where: { id: planoAberto.id },
          data: { vigenciaFim: paraDataUTC(diaAnterior(VIGENCIA_INICIO)) },
        });
      }
      await tx.planoComissao.create({
        data: {
          colaboradorId: colaborador.id,
          tipo: alvo.tipo,
          config: alvo.config,
          vigenciaInicio: paraDataUTC(VIGENCIA_INICIO),
          vigenciaFim: null,
        },
      });
    });
  }
}

async function main() {
  const aplicar = process.argv.slice(2).includes("--apply");
  const log: string[] = [];
  log.push(aplicar ? "=== v1.2 — MODO --apply (GRAVANDO) ===" : "=== v1.2 — DRY-RUN (nada gravado) ===");

  await ajustarMetas(aplicar, log);
  log.push("\n=== PLANOS ===");
  await definirPlano("Roberta", aplicar, log);
  await definirPlano("Yuri", aplicar, log);

  console.log(log.join("\n"));
  console.log(aplicar ? "\n--apply concluído." : "\nDry-run concluído. Rode com --apply para gravar.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
