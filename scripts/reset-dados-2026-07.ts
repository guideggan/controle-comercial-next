#!/usr/bin/env -S npx tsx
// ============================================================
// RESET DE DADOS v1.1 (ajustes pós-teste 2026-07 — CHANGES-2026-07.md item B)
// ============================================================
// Script standalone (tsx, roda contra o Neon real via `db` do Prisma) que
// aplica a reconciliação de dados pedida pelo usuário DEPOIS de testar o
// app: recriar o catálogo de produtos por categoria, reconciliar a lista de
// colaboradores para o time canônico (arquivando o resto, nunca apagando —
// são referenciados pelo histórico Jan–Jun importado na Fase 10), definir
// as metas do mês corrente, e limpar as vendas de Julho/2026 (mantendo
// Jan–Jun intactas).
//
// IDEMPOTENTE por design: toda escrita é um upsert por chave natural (nome,
// case-insensitive) ou um filtro estrito de competência (só mesReferencia
// = 2026-07-01) — rodar o script duas vezes seguidas produz o MESMO estado
// final, sem duplicar nem apagar histórico por engano.
//
// Uso:
//   npx tsx scripts/reset-dados-2026-07.ts                 (dry-run, não grava nada)
//   npx tsx scripts/reset-dados-2026-07.ts --apply          (grava no banco)
//
// NÃO apaga colaboradores fora do time canônico — eles são ARQUIVADOS
// (ativo=false), pois são referenciados por vendas/parcelas/apurações
// históricas de Jan–Jun (Fase 10). Só a venda de Julho/2026 (e parcelas +
// apurações vinculadas) é removida de fato, via onDelete Cascade de
// Parcela e um delete explícito de ComissaoApurada da competência.

import { PrismaClient, type CategoriaProduto, type Papel } from "@prisma/client";

const db = new PrismaClient();

const MES_CORRENTE = "2026-07-01"; // competência de "hoje" no momento do reset
const MES_JULHO = "2026-07-01"; // vendas a limpar (mesma competência, nomes distintos por clareza de leitura no código)

function paraDataUTC(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function slugEmail(nome: string): string {
  const slug = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug}@controlecomercial.local`;
}

// ============================================================
// 1) PRODUTOS — recriar o catálogo por categoria (CHANGES item 7)
// ============================================================

const CATALOGO_PRODUTOS: Array<{ nome: string; categoria: CategoriaProduto }> = [
  { nome: "Mentoria Elite", categoria: "ACELERACAO_MENTORIA" },
  { nome: "Mentoria Pro", categoria: "ACELERACAO_MENTORIA" },
  { nome: "Mentoria Master", categoria: "ACELERACAO_MENTORIA" },
  { nome: "Next Track", categoria: "IMERSAO_PRESENCIAL" },
  { nome: "Next Experience", categoria: "EVENTO_PRESENCIAL" },
  { nome: "Tiktok Day", categoria: "EVENTO_PRESENCIAL" },
];

async function resetProdutos(aplicar: boolean, log: string[]) {
  log.push("\n=== PRODUTOS ===");

  const existentes = await db.produto.findMany();
  const porNomeLower = new Map(existentes.map((p) => [p.nome.trim().toLowerCase(), p]));

  // Cria/atualiza o catálogo canônico (upsert por nome case-insensitive).
  for (const item of CATALOGO_PRODUTOS) {
    const existente = porNomeLower.get(item.nome.trim().toLowerCase());
    if (existente) {
      log.push(
        `  [manter] "${existente.nome}" já existe (id=${existente.id}) — garantindo categoria=${item.categoria} e ativo=true`,
      );
      if (aplicar) {
        await db.produto.update({
          where: { id: existente.id },
          data: { categoria: item.categoria, ativo: true, nome: item.nome },
        });
      }
    } else {
      log.push(`  [criar] "${item.nome}" (categoria=${item.categoria})`);
      if (aplicar) {
        await db.produto.create({
          data: { nome: item.nome, categoria: item.categoria, ativo: true },
        });
      }
    }
  }

  // Desativa (NUNCA hard-delete — podem estar referenciados por vendas
  // históricas Jan–Jun) todo produto que não está no catálogo canônico.
  const nomesCanonicosLower = new Set(
    CATALOGO_PRODUTOS.map((p) => p.nome.trim().toLowerCase()),
  );
  for (const produto of existentes) {
    if (nomesCanonicosLower.has(produto.nome.trim().toLowerCase())) continue;
    if (!produto.ativo) continue; // já desativado, nada a fazer
    log.push(`  [desativar] "${produto.nome}" (id=${produto.id}) — fora do catálogo canônico`);
    if (aplicar) {
      await db.produto.update({ where: { id: produto.id }, data: { ativo: false } });
    }
  }
}

// ============================================================
// 2) COLABORADORES — reconciliar para o time canônico (CHANGES item 5)
// ============================================================

type ColaboradorCanonico = {
  nome: string;
  papel: Papel;
  // Variantes de nome conhecidas na base atual que devem casar com este
  // canônico (case-insensitive) — além do próprio `nome`.
  aliases?: string[];
};

const TIME_CANONICO: ColaboradorCanonico[] = [
  { nome: "Yuri", papel: "CLOSER" },
  { nome: "Paola", papel: "CLOSER" },
  { nome: "Pedro", papel: "CLOSER", aliases: ["Pedro Closer"] },
  { nome: "Douglas", papel: "CLOSER", aliases: ["Douglas Closer"] },
  { nome: "Roberta", papel: "CLOSER" },
  { nome: "João Pedro", papel: "SDR", aliases: ["JP", "Joao Pedro"] },
  { nome: "Bruna", papel: "SDR" },
  { nome: "José", papel: "SDR", aliases: ["Jose"] },
  { nome: "Time SS", papel: "SS" },
  { nome: "Outros", papel: "SDR" }, // placeholder de origem — papel SDR só para caber no enum; NUNCA recebe plano/comissão
];

// Normaliza para comparação: minúsculo, sem acento.
function normalizar(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

async function resetColaboradores(aplicar: boolean, log: string[]) {
  log.push("\n=== COLABORADORES ===");

  const existentes = await db.colaborador.findMany();
  const casados = new Set<string>(); // ids já reconciliados com um canônico

  for (const canonico of TIME_CANONICO) {
    const nomeCanonicoNorm = normalizar(canonico.nome);
    const aliasesNorm = (canonico.aliases ?? []).map(normalizar);

    // Ordem de prioridade determinística (corrige um bug real encontrado ao
    // validar idempotência: rodar o script 2x seguidas SEM esta prioridade
    // podia casar um alias como "JP" antes do registro já corretamente
    // renomeado "João Pedro", duplicando a pessoa). Nunca re-casa um id já
    // usado por OUTRO canônico nesta mesma execução (`casados`).
    // 1) match EXATO pelo nome canônico (já reconciliado em execução anterior)
    // 2) match por alias, entre os AINDA ativos
    // 3) match por alias, mesmo entre os já arquivados (idempotência do 1º --apply)
    const disponiveis = existentes.filter((c) => !casados.has(c.id));
    const existente =
      disponiveis.find((c) => normalizar(c.nome) === nomeCanonicoNorm) ??
      disponiveis.find((c) => c.ativo && aliasesNorm.includes(normalizar(c.nome))) ??
      disponiveis.find((c) => aliasesNorm.includes(normalizar(c.nome)));

    if (existente) {
      casados.add(existente.id);
      const precisaAtualizar =
        existente.nome !== canonico.nome ||
        existente.papel !== canonico.papel ||
        !existente.ativo;
      log.push(
        `  [manter] "${existente.nome}" (id=${existente.id}) -> canônico "${canonico.nome}"/${canonico.papel}${precisaAtualizar ? " (atualizando nome/papel/ativo)" : ""}`,
      );
      if (aplicar && precisaAtualizar) {
        await db.colaborador.update({
          where: { id: existente.id },
          data: { nome: canonico.nome, papel: canonico.papel, ativo: true },
        });
      }
    } else {
      log.push(`  [criar] "${canonico.nome}" (${canonico.papel})`);
      if (aplicar) {
        const email = slugEmail(canonico.nome);
        await db.colaborador.create({
          data: { nome: canonico.nome, papel: canonico.papel, ativo: true, email },
        });
      }
    }
  }

  // Arquiva (ativo=false) TODO colaborador que não casou com nenhum
  // canônico acima — nunca hard-delete (referenciados por Jan–Jun).
  for (const colaborador of existentes) {
    if (casados.has(colaborador.id)) continue;
    if (colaborador.papel === "ADMIN") continue; // conta de admin nunca é tocada aqui
    if (!colaborador.ativo) continue; // já arquivado
    log.push(`  [arquivar] "${colaborador.nome}" (id=${colaborador.id}, ${colaborador.papel})`);
    if (aplicar) {
      await db.colaborador.update({ where: { id: colaborador.id }, data: { ativo: false } });
    }
  }
}

// ============================================================
// 3) METAS do mês corrente (CHANGES item 6) — Paola PENDENTE (não definida)
// ============================================================

type MetaCanonica =
  | { nome: string; unidade: "VALOR"; valorMeta: number }
  | { nome: string; unidade: "AGENDAMENTOS"; metaAgendamentos: number };

const METAS_MES_CORRENTE: MetaCanonica[] = [
  { nome: "Pedro", unidade: "VALOR", valorMeta: 233333 },
  { nome: "Douglas", unidade: "VALOR", valorMeta: 233333 },
  { nome: "Roberta", unidade: "VALOR", valorMeta: 233333 },
  { nome: "Yuri", unidade: "VALOR", valorMeta: 650000 },
  { nome: "João Pedro", unidade: "AGENDAMENTOS", metaAgendamentos: 50 },
  { nome: "Bruna", unidade: "AGENDAMENTOS", metaAgendamentos: 45 },
  { nome: "José", unidade: "AGENDAMENTOS", metaAgendamentos: 40 },
  { nome: "Time SS", unidade: "AGENDAMENTOS", metaAgendamentos: 55 },
  // Paola: PENDENTE — usuário vai informar depois (ver CHANGES-2026-07.md
  // "Pendências do usuário"). Deliberadamente OMITIDA aqui; logamos um
  // aviso explícito para não passar despercebido.
];

async function resetMetas(aplicar: boolean, log: string[]) {
  log.push(`\n=== METAS (competência ${MES_CORRENTE}) ===`);
  log.push(
    "  [PENDENTE] Meta da Paola NÃO foi definida — usuário vai informar depois (CHANGES-2026-07.md).",
  );

  const colaboradores = await db.colaborador.findMany({
    where: { ativo: true },
  });
  const porNome = new Map(colaboradores.map((c) => [normalizar(c.nome), c]));

  for (const meta of METAS_MES_CORRENTE) {
    const colaborador = porNome.get(normalizar(meta.nome));
    if (!colaborador) {
      log.push(`  [ERRO] colaborador "${meta.nome}" não encontrado — meta NÃO definida`);
      continue;
    }

    const valorMeta = meta.unidade === "VALOR" ? meta.valorMeta : null;
    const metaAgendamentos = meta.unidade === "AGENDAMENTOS" ? meta.metaAgendamentos : null;

    log.push(
      `  [definir] ${meta.nome} (${colaborador.papel}): ${meta.unidade === "VALOR" ? `R$${valorMeta}` : `${metaAgendamentos} reuniões realizadas`}`,
    );

    if (aplicar) {
      await db.meta.upsert({
        where: {
          colaboradorId_mesReferencia: {
            colaboradorId: colaborador.id,
            mesReferencia: paraDataUTC(MES_CORRENTE),
          },
        },
        create: {
          colaboradorId: colaborador.id,
          mesReferencia: paraDataUTC(MES_CORRENTE),
          unidade: meta.unidade,
          valorMeta,
          metaAgendamentos,
        },
        update: { unidade: meta.unidade, valorMeta, metaAgendamentos },
      });
    }
  }
}

// ============================================================
// 4) VENDAS DE JULHO/2026 — remover (mantendo Jan–Jun) (CHANGES item 8)
// ============================================================

async function limparVendasJulho(aplicar: boolean, log: string[]) {
  log.push(`\n=== VENDAS DE JULHO (mesReferencia=${MES_JULHO}) ===`);

  const mesReferenciaData = paraDataUTC(MES_JULHO);

  const vendas = await db.venda.findMany({
    where: { mesReferencia: mesReferenciaData },
    select: { id: true, alunoNome: true, dataVenda: true },
  });
  log.push(`  ${vendas.length} venda(s) de Julho encontrada(s):`);
  for (const v of vendas) {
    log.push(`    - ${v.alunoNome} (id=${v.id}, dataVenda=${v.dataVenda.toISOString().slice(0, 10)})`);
  }

  const apuracoes = await db.comissaoApurada.count({
    where: { mesReferencia: mesReferenciaData },
  });
  log.push(`  ${apuracoes} apuração(ões) de comissão de Julho encontrada(s)`);

  if (aplicar) {
    // ComissaoApurada primeiro (não tem FK para Venda, mas é da mesma
    // competência — remover junto evita um snapshot órfão apontando para
    // uma competência sem vendas).
    const apuracoesDeletadas = await db.comissaoApurada.deleteMany({
      where: { mesReferencia: mesReferenciaData },
    });
    log.push(`  [ok] ${apuracoesDeletadas.count} apuração(ões) removida(s)`);

    // Parcela tem onDelete: Cascade em relação a Venda — deletar a Venda já
    // remove as parcelas vinculadas automaticamente (ver prisma/schema.prisma).
    const vendasDeletadas = await db.venda.deleteMany({
      where: { mesReferencia: mesReferenciaData },
    });
    log.push(`  [ok] ${vendasDeletadas.count} venda(s) removida(s) (parcelas em cascade)`);
  }
}

// ============================================================
// main
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const aplicar = args.includes("--apply");

  const log: string[] = [];
  log.push(
    aplicar
      ? "=== RESET DE DADOS v1.1 — MODO --apply (GRAVANDO NO BANCO) ==="
      : "=== RESET DE DADOS v1.1 — DRY-RUN (nada será gravado) ===",
  );

  await resetProdutos(aplicar, log);
  await resetColaboradores(aplicar, log);
  await resetMetas(aplicar, log);
  await limparVendasJulho(aplicar, log);

  console.log(log.join("\n"));

  if (!aplicar) {
    console.log(
      "\nDry-run concluído. Nenhuma escrita foi feita. Rode com --apply para gravar.",
    );
  } else {
    console.log("\n--apply concluído. Reset de dados v1.1 aplicado.");
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
