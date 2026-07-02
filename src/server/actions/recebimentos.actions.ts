"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/server/auth/session";
import {
  marcarParcelaPaga,
  reverterParcelaPendente,
} from "@/server/services/recebimento.service";
import { registrarAudit } from "@/server/services/audit.service";
import { getParcelaComVenda } from "@/server/repositories/recebimento.repo";
import type { MarcarParcelaPagaInput } from "@/server/actions/recebimentos.schemas";

// Server actions de recebimento (PGTO-01). Gated por requireRole("ADMIN")
// — nenhuma escrita/leitura de dados acontece antes dessa checagem
// (Pitfall 10, mesmo padrão de vendas.actions.ts).
//
// As actions NÃO validam manualmente: quem valida é o service
// (marcarParcelaPaga), via marcarParcelaPagaSchema. Erros do service
// (parcela não encontrada, venda fechada) propagam para a UI, que mostra
// um toast de erro.
//
// Auditoria (AUDIT-01): registrada APÓS a escrita do service — é uma trilha,
// não uma invariante transacional crítica (a ação de negócio já terminou com
// sucesso quando chegamos aqui); registrar dentro da mesma transação exigiria
// expor `tx` do service para a action, o que quebraria o encapsulamento
// atual. NÃO duplica authz: roda depois do requireRole já feito acima.

export async function marcarParcelaPagaAction(
  parcelaId: string,
  input: MarcarParcelaPagaInput,
) {
  const user = await requireRole("ADMIN");

  const parcela = await marcarParcelaPaga(parcelaId, input);
  const parcelaComVenda = await getParcelaComVenda(parcelaId);

  await registrarAudit({
    acao: "MARCAR_PAGO",
    entidade: "parcela",
    entidadeId: parcelaId,
    colaboradorId: parcelaComVenda?.venda.closerId ?? null,
    usuarioId: user.id,
    dadosDepois: {
      valorRecebido: input.valorRecebido,
      status: "PAGO",
    },
  });

  // Revalida a listagem de vendas de forma ampla — a página de detalhe da
  // venda é revalidada pelo router.refresh() do client, mesmo padrão já
  // usado nos forms de venda (vendas.actions.ts).
  revalidatePath("/vendas");

  return parcela;
}

export async function reverterParcelaPendenteAction(parcelaId: string) {
  const user = await requireRole("ADMIN");

  const parcelaAntes = await getParcelaComVenda(parcelaId);
  const parcela = await reverterParcelaPendente(parcelaId);

  await registrarAudit({
    acao: "REVERTER_PAGO",
    entidade: "parcela",
    entidadeId: parcelaId,
    colaboradorId: parcelaAntes?.venda.closerId ?? null,
    usuarioId: user.id,
    dadosAntes: {
      valorRecebido:
        parcelaAntes?.valorRecebido !== null &&
        parcelaAntes?.valorRecebido !== undefined
          ? Number(parcelaAntes.valorRecebido)
          : null,
      status: "PAGO",
    },
    dadosDepois: { status: "PENDENTE" },
  });

  revalidatePath("/vendas");

  return parcela;
}
