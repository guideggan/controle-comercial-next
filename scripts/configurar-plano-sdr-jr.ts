#!/usr/bin/env -S npx tsx
// ============================================================
// CONFIGURAÇÃO DO PLANO "SDR/Social Selling Jr - OTE" — José, Bruna e
// Time SS (v1.3)
// ============================================================
// Script standalone (tsx, PrismaClient direto contra o Neon — mesmo padrão
// de scripts/definir-plano-closer-jr.ts / scripts/configurar-planos-v1.2.ts)
// que define o plano de comissão `salario_bonus_atingimento` (salário fixo
// R$3.000 + bônus por faixa de atingimento da meta) para José, Bruna e
// Time SS, replicando a mesma regra de versionamento por vigência de
// src/server/services/plano-comissao.service.ts#definirPlanoComissao: fecha
// o plano aberto atual (se houver) gravando vigenciaFim = dia anterior, e
// cria a nova linha aberta — tudo em uma única transação.
//
// DIFERENÇA em relação a definir-plano-closer-jr.ts: aquele script exige
// papel CLOSER (a meta é em R$/VALOR); este exige papel SDR ou SS, pois a
// meta desses colaboradores é em AGENDAMENTOS (reuniões REALIZADAS) — o
// atingimento vem de contarCallsRealizadas/metaAgendamentos, calculado em
// apuracao.service.ts (branch por unidade da meta, v1.3), NÃO de recebido.
//
// IDEMPOTENTE: se o colaborador já tem um plano ABERTO do mesmo tipo com a
// MESMA config (salarioFixo + faixas), não faz nada (evita empilhar
// vigências idênticas a cada execução).
//
// NÃO toca na meta (já cadastrada — Bruna 45, José 40, Time SS 55,
// AGENDAMENTOS) nem em nenhum outro colaborador (João Pedro fica pendente,
// closers não são tocados).
//
// Uso:
//   npx tsx scripts/configurar-plano-sdr-jr.ts                (dry-run)
//   npx tsx scripts/configurar-plano-sdr-jr.ts --apply         (grava no banco)

import { PrismaClient, type PlanoTipo } from "@prisma/client";

const db = new PrismaClient();

// Vigência a partir do mês corrente (competência de "hoje" no momento da
// configuração) — mesma convenção VIGENCIA_INICIO dos scripts irmãos.
const VIGENCIA_INICIO = "2026-07-01";

const NOMES_ALVO = ["José", "Bruna", "Time SS"];
const PAPEIS_PERMITIDOS = new Set(["SDR", "SS"]);

const SALARIO_FIXO = 3000;
const FAIXAS = [
  { minAtingimento: 0, bonus: 0 },
  { minAtingimento: 71, bonus: 1500 },
  { minAtingimento: 86, bonus: 2250 },
  { minAtingimento: 100, bonus: 3000 },
  { minAtingimento: 120, bonus: 4500 },
  { minAtingimento: 150, bonus: 6000 },
];

const CONFIG_PLANO_SDR_JR = { salarioFixo: SALARIO_FIXO, faixas: FAIXAS };
const TIPO_PLANO: PlanoTipo = "salario_bonus_atingimento";

function normalizar(nome: string): string {
  return nome.trim().toLowerCase();
}

function paraDataUTC(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

// Mesma regra de diaAnterior de plano-comissao.service.ts — string pura,
// nunca round-trip por Date ciente de timezone (Pitfall 6).
function diaAnterior(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const dataUtc = new Date(Date.UTC(ano, mes - 1, dia));
  dataUtc.setUTCDate(dataUtc.getUTCDate() - 1);

  const anoAnterior = dataUtc.getUTCFullYear();
  const mesAnterior = String(dataUtc.getUTCMonth() + 1).padStart(2, "0");
  const diaAnteriorStr = String(dataUtc.getUTCDate()).padStart(2, "0");
  return `${anoAnterior}-${mesAnterior}-${diaAnteriorStr}`;
}

// Comparação profunda insensível à ORDEM DE CHAVES de objeto (mas sensível à
// ordem de array). Necessário porque Postgres JSONB NÃO preserva a ordem de
// inserção das chaves de objeto (normaliza na escrita) — comparar via
// JSON.stringify ingênuo entre o literal TypeScript (chaves na ordem que
// escrevi) e o valor lido de volta do banco (chaves reordenadas pelo
// Postgres) sempre dá falso-negativo, quebrando a idempotência do script.
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

async function definirPlanoSdrJr(aplicar: boolean, log: string[]) {
  log.push("\n=== PLANO SDR/SOCIAL SELLING JR (salario_bonus_atingimento) ===");

  const colaboradores = await db.colaborador.findMany({
    where: { ativo: true },
  });
  const porNome = new Map(colaboradores.map((c) => [normalizar(c.nome), c]));

  for (const nomeAlvo of NOMES_ALVO) {
    const colaborador = porNome.get(normalizar(nomeAlvo));
    if (!colaborador) {
      log.push(`  [ERRO] colaborador "${nomeAlvo}" não encontrado — plano NÃO definido`);
      continue;
    }
    if (!PAPEIS_PERMITIDOS.has(colaborador.papel)) {
      log.push(
        `  [ERRO] "${nomeAlvo}" (id=${colaborador.id}) não é SDR/SS (papel=${colaborador.papel}) — plano NÃO definido`,
      );
      continue;
    }

    const planoAberto = await db.planoComissao.findFirst({
      where: { colaboradorId: colaborador.id, vigenciaFim: null },
    });

    if (
      planoAberto &&
      planoAberto.tipo === TIPO_PLANO &&
      configsIguais(planoAberto.config, CONFIG_PLANO_SDR_JR)
    ) {
      log.push(
        `  [manter] ${nomeAlvo} (id=${colaborador.id}) já tem o plano SDR Jr vigente (id=${planoAberto.id}) — nada a fazer`,
      );
      continue;
    }

    log.push(
      `  [definir] ${nomeAlvo} (id=${colaborador.id}): salário fixo R$${SALARIO_FIXO} + ${FAIXAS.length} faixas de bônus, vigência a partir de ${VIGENCIA_INICIO}` +
        (planoAberto ? ` (fechando plano anterior "${planoAberto.tipo}", id=${planoAberto.id})` : ""),
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
            tipo: TIPO_PLANO,
            config: CONFIG_PLANO_SDR_JR,
            vigenciaInicio: paraDataUTC(VIGENCIA_INICIO),
            vigenciaFim: null,
          },
        });
      });
    }
  }
}

async function conferirMetas(log: string[]) {
  log.push(`\n=== CONFERÊNCIA DE METAS (competência ${VIGENCIA_INICIO}) ===`);

  const colaboradores = await db.colaborador.findMany({
    where: { ativo: true, nome: { in: NOMES_ALVO } },
  });

  for (const colaborador of colaboradores) {
    const meta = await db.meta.findUnique({
      where: {
        colaboradorId_mesReferencia: {
          colaboradorId: colaborador.id,
          mesReferencia: paraDataUTC(VIGENCIA_INICIO),
        },
      },
    });
    if (!meta) {
      log.push(`  [AVISO] ${colaborador.nome}: sem meta definida em ${VIGENCIA_INICIO}`);
    } else {
      log.push(
        `  [ok] ${colaborador.nome}: meta ${meta.unidade} = ${meta.unidade === "VALOR" ? `R$${meta.valorMeta}` : `${meta.metaAgendamentos} reuniões`}`,
      );
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const aplicar = args.includes("--apply");

  const log: string[] = [];
  log.push(
    aplicar
      ? "=== CONFIGURAÇÃO PLANO SDR JR — MODO --apply (GRAVANDO NO BANCO) ==="
      : "=== CONFIGURAÇÃO PLANO SDR JR — DRY-RUN (nada será gravado) ===",
  );

  await definirPlanoSdrJr(aplicar, log);
  await conferirMetas(log);

  console.log(log.join("\n"));

  if (!aplicar) {
    console.log(
      "\nDry-run concluído. Nenhuma escrita foi feita. Rode com --apply para gravar.",
    );
  } else {
    console.log("\n--apply concluído. Plano SDR Jr configurado para José, Bruna e Time SS.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
