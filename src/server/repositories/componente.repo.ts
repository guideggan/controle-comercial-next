import "server-only";

import { db } from "@/lib/db";
import type { ComponentePagamento } from "@/domain/vendas/componentes";
import { mesDaData } from "@/domain/vendas/componentes";

// Repositório dos componentes do plano de pagamento (Fase 11) — funções
// puras, sem authz (mesmo padrão de venda.repo.ts). A autorização vive nas
// Server Actions; a orquestração transacional (venda + componentes + parcelas
// atômicos) vive em venda.service.ts.

type ComponenteClient = Pick<typeof db, "componentePagamento" | "parcela">;

// Mesmo helper de venda.repo.ts/recebimento.repo.ts: o Prisma Client 6.19.3
// rejeita string "YYYY-MM-DD" pura em coluna @db.Date. Construído via
// Date.UTC a partir dos componentes da string, nunca `new Date(string)`
// (Pitfall 6).
function paraDataUTC(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Converte um `Date` (@db.Date) de volta para "YYYY-MM-DD" via getters UTC —
 * nunca `.toISOString()`, que é ciente de timezone. */
export function dataParaString(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(data.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export type InserirComponenteData = ComponentePagamento & { ordem: number };

/**
 * Insere os componentes de uma venda e devolve os ids na MESMA ordem do array
 * de entrada.
 *
 * Usa `create` em sequência em vez de `createMany` de propósito: precisamos
 * dos ids gerados para vincular cada parcela ao seu componente
 * (`Parcela.componenteId`), e `createMany` não retorna as linhas criadas. São
 * poucos componentes por venda (1 a 3 no mundo real), então o custo é
 * irrelevante — e tudo roda dentro da transação do service.
 *
 * `mesPrevisto` é derivado de `dataPrevista` AQUI, no único ponto de escrita,
 * e gravado explicitamente (Pitfall 2: nunca derivar no read).
 */
export async function inserirComponentes(
  tx: ComponenteClient,
  vendaId: string,
  componentes: InserirComponenteData[],
): Promise<string[]> {
  const ids: string[] = [];

  for (const componente of componentes) {
    const criado = await tx.componentePagamento.create({
      data: {
        vendaId,
        ordem: componente.ordem,
        forma: componente.forma,
        contaCheioNoMes: componente.contaCheioNoMes,
        valor: componente.valor,
        parcelas: componente.parcelas,
        dataPrevista: paraDataUTC(componente.dataPrevista),
        mesPrevisto: paraDataUTC(mesDaData(componente.dataPrevista)),
        descricao: componente.descricao ?? null,
      },
      select: { id: true },
    });
    ids.push(criado.id);
  }

  return ids;
}

/** Apaga todos os componentes de uma venda. As parcelas vinculadas NÃO são
 * apagadas junto (a FK é `onDelete: SetNull`) — quem decide o que fazer com
 * elas é o service, que preserva as PAGAS e regenera as pendentes. */
export function apagarComponentes(tx: ComponenteClient, vendaId: string) {
  return tx.componentePagamento.deleteMany({ where: { vendaId } });
}

export function listarComponentesDaVenda(vendaId: string) {
  return db.componentePagamento.findMany({
    where: { vendaId },
    orderBy: { ordem: "asc" },
  });
}

/**
 * Todos os componentes que podem influenciar o faturamento de uma
 * competência:
 *   - os datados NESTE mês (o termo 1 do valor presente), venham da venda que
 *     vierem — inclusive de vendas de outros meses (o caso da Patrícia, cujo
 *     segundo cartão cai no mês seguinte ao da venda);
 *   - os das vendas COM COMPETÊNCIA neste mês (necessários para o TCV, mesmo
 *     quando o dinheiro cai em outro mês).
 *
 * Gate de aprovação (v1.1): só vendas APROVADA entram — mesma regra de
 * `listarRecebimentosDoMes`, para que uma venda pendente de aprovação nunca
 * infle o faturamento.
 */
export function listarComponentesParaFaturamento(mesReferencia: string) {
  const mes = paraDataUTC(mesReferencia);

  return db.componentePagamento.findMany({
    where: {
      venda: { statusAprovacao: "APROVADA" },
      OR: [{ mesPrevisto: mes }, { venda: { mesReferencia: mes } }],
    },
    include: {
      venda: { select: { id: true, mesReferencia: true, closerId: true, sdrId: true } },
    },
  });
}
