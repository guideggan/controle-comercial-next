#!/usr/bin/env -S npx tsx
// ============================================================
// CONFIGURAÇÃO DO PLANO ESPECIAL — João Pedro (v1.4/JP-01)
// ============================================================
// Script standalone (tsx, PrismaClient direto contra o Neon — mesmo padrão
// de scripts/configurar-plano-sdr-jr.ts), IDEMPOTENTE: define o plano
// `progressivo_atingimento` de João Pedro — % sobre o valor RECEBIDO no mês
// das vendas em que ele é o SDR de origem (sdrId), com o percentual
// escolhido pela faixa de atingimento de AGENDAMENTOS (reuniões REALIZADAS
// ÷ meta de agendamento):
//   < 70%  -> 0%
//   70%    -> 0,5%
//   80%    -> 0,75%
//   90%    -> 1,0%
//   100%+  -> 1,5%
//
// A base "recebido como SDR" (porSdr, não porCloser) e o atingimento por
// AGENDAMENTOS (não VALOR) já são resolvidos automaticamente em
// apuracao.service.ts pelo papel do colaborador (v1.3/v1.4) — este script
// só grava a config do plano em si, mesmo padrão de versionamento por
// vigência de definirPlanoComissao (plano-comissao.service.ts): fecha o
// plano aberto atual (se houver) gravando vigenciaFim = dia anterior, e cria
// a nova linha aberta — tudo em uma única transação.
//
// NÃO toca na meta de João Pedro (AGENDAMENTOS = 50, já cadastrada — só
// confere e avisa se estiver ausente/diferente) nem em nenhum outro
// colaborador.
//
// Uso:
//   npx tsx scripts/configurar-plano-jp.ts             (dry-run)
//   npx tsx scripts/configurar-plano-jp.ts --apply       (grava no banco)

import { PrismaClient, type PlanoTipo } from "@prisma/client";

const db = new PrismaClient();

// Vigência a partir do mês corrente (competência de "hoje" no momento da
// configuração) — mesma convenção VIGENCIA_INICIO dos scripts irmãos.
const VIGENCIA_INICIO = "2026-07-01";

const NOME_ALVO = "João Pedro";
const PAPEL_PERMITIDO = "SDR";

// Faixas em FRAÇÃO (0.70 = 70%, 0.005 = 0,5%) — mesma convenção de
// configProgressivoAtingimentoSchema (planos-comissao.schemas.ts):
// deAtingimento/percentual ascendentes, primeira faixa cobre "abaixo do
// menor patamar" (0% de comissão abaixo de 70% de atingimento).
const FAIXAS = [
  { deAtingimento: 0, percentual: 0 },
  { deAtingimento: 0.7, percentual: 0.005 },
  { deAtingimento: 0.8, percentual: 0.0075 },
  { deAtingimento: 0.9, percentual: 0.01 },
  { deAtingimento: 1.0, percentual: 0.015 },
];

const CONFIG_PLANO_JP = { faixas: FAIXAS };
const TIPO_PLANO: PlanoTipo = "progressivo_atingimento";

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

async function definirPlanoJp(aplicar: boolean, log: string[]) {
  log.push("\n=== PLANO ESPECIAL JOÃO PEDRO (progressivo_atingimento, base=recebido como SDR) ===");

  const colaborador = await db.colaborador.findFirst({
    where: { ativo: true, nome: { equals: NOME_ALVO, mode: "insensitive" } },
  });
  if (!colaborador) {
    log.push(`  [ERRO] colaborador "${NOME_ALVO}" não encontrado — plano NÃO definido`);
    return;
  }
  if (colaborador.papel !== PAPEL_PERMITIDO) {
    log.push(
      `  [ERRO] "${NOME_ALVO}" (id=${colaborador.id}) não é SDR (papel=${colaborador.papel}) — plano NÃO definido`,
    );
    return;
  }

  const planoAberto = await db.planoComissao.findFirst({
    where: { colaboradorId: colaborador.id, vigenciaFim: null },
  });

  if (
    planoAberto &&
    planoAberto.tipo === TIPO_PLANO &&
    configsIguais(planoAberto.config, CONFIG_PLANO_JP)
  ) {
    log.push(
      `  [manter] ${NOME_ALVO} (id=${colaborador.id}) já tem o plano vigente (id=${planoAberto.id}) — nada a fazer`,
    );
    return;
  }

  log.push(
    `  [definir] ${NOME_ALVO} (id=${colaborador.id}): ${FAIXAS.length} faixas (0/70/80/90/100% -> 0/0,5/0,75/1,0/1,5%), vigência a partir de ${VIGENCIA_INICIO}` +
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
          config: CONFIG_PLANO_JP,
          vigenciaInicio: paraDataUTC(VIGENCIA_INICIO),
          vigenciaFim: null,
        },
      });
    });
  }
}

// Só CONFERE a meta (AGENDAMENTOS=50, já cadastrada) — nunca escreve.
async function conferirMeta(log: string[]) {
  log.push(`\n=== CONFERÊNCIA DE META (competência ${VIGENCIA_INICIO}) ===`);

  const colaborador = await db.colaborador.findFirst({
    where: { ativo: true, nome: { equals: NOME_ALVO, mode: "insensitive" } },
  });
  if (!colaborador) return;

  const meta = await db.meta.findUnique({
    where: {
      colaboradorId_mesReferencia: {
        colaboradorId: colaborador.id,
        mesReferencia: paraDataUTC(VIGENCIA_INICIO),
      },
    },
  });
  if (!meta) {
    log.push(`  [AVISO] ${NOME_ALVO}: sem meta definida em ${VIGENCIA_INICIO}`);
  } else if (meta.unidade !== "AGENDAMENTOS") {
    log.push(
      `  [AVISO] ${NOME_ALVO}: meta é unidade ${meta.unidade}, esperado AGENDAMENTOS`,
    );
  } else {
    log.push(`  [ok] ${NOME_ALVO}: meta AGENDAMENTOS = ${meta.metaAgendamentos} reuniões`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const aplicar = args.includes("--apply");

  const log: string[] = [];
  log.push(
    aplicar
      ? "=== CONFIGURAÇÃO PLANO JOÃO PEDRO — MODO --apply (GRAVANDO NO BANCO) ==="
      : "=== CONFIGURAÇÃO PLANO JOÃO PEDRO — DRY-RUN (nada será gravado) ===",
  );

  await definirPlanoJp(aplicar, log);
  await conferirMeta(log);

  console.log(log.join("\n"));

  if (!aplicar) {
    console.log(
      "\nDry-run concluído. Nenhuma escrita foi feita. Rode com --apply para gravar.",
    );
  } else {
    console.log("\n--apply concluído. Plano especial de João Pedro configurado.");
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
