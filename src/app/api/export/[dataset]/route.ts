import { NextResponse } from "next/server";

import { requireRole } from "@/server/auth/session";
import { listarVendas } from "@/server/repositories/venda.repo";
import { listarApuracoesDoMes } from "@/server/services/apuracao.service";
import { listarMetasMes } from "@/server/services/meta.service";
import { listarColaboradores } from "@/server/repositories/colaborador.repo";
import { paraCsv } from "@/lib/csv";

// Rota de exportação (AUDIT-02): admin exporta vendas/comissões/metas do mês
// selecionado para CSV (abre nativamente no Excel). Gated por
// requireRole("ADMIN") ANTES de qualquer leitura (Pitfall 10) — nenhum
// cálculo novo aqui, cada dataset é lido das mesmas fontes já usadas pelo
// dashboard/telas existentes.

const LABEL_PAPEL: Record<string, string> = {
  ADMIN: "Admin",
  CLOSER: "Closer",
  SDR: "SDR",
  SS: "SS",
};

function formatarDataUTC(data: Date | null): string {
  if (!data) return "";
  const dia = String(data.getUTCDate()).padStart(2, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const ano = data.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

function mesAnoUTC(data: Date): string {
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const ano = data.getUTCFullYear();
  return `${mes}/${ano}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dataset: string }> },
) {
  await requireRole("ADMIN");

  const { dataset } = await params;
  const url = new URL(request.url);
  const mesParam = url.searchParams.get("mes");
  const mes =
    mesParam && /^\d{4}-\d{2}-01$/.test(mesParam) ? mesParam : mesCorrenteUTC();

  let csv: string;
  let nomeArquivo: string;

  if (dataset === "vendas") {
    const [vendas, colaboradores] = await Promise.all([
      listarVendas({ mesReferencia: mes }),
      listarColaboradores(),
    ]);
    const nomePorId = new Map(colaboradores.map((c) => [c.id, c.nome]));
    csv = paraCsv(
      [
        "Data da venda",
        "Aluno",
        "Pagador",
        "Produto",
        "Plataforma",
        "Tipo de pagamento",
        "Valor total",
        "Entrada",
        "Mensalidade",
        "Nº parcelas",
        "Closer",
        "SDR",
      ],
      vendas.map((v) => [
        formatarDataUTC(v.dataVenda),
        v.alunoNome,
        v.pagadorNome,
        v.produto.nome,
        v.plataforma,
        v.tipoPagamento,
        Number(v.valorTotal).toFixed(2).replace(".", ","),
        Number(v.entrada).toFixed(2).replace(".", ","),
        Number(v.valorMensalidade).toFixed(2).replace(".", ","),
        v.numeroParcelas,
        v.closer.nome,
        v.sdrId ? (nomePorId.get(v.sdrId) ?? "") : "",
      ]),
    );
    nomeArquivo = `vendas-${mes.slice(0, 7)}.csv`;
  } else if (dataset === "comissoes") {
    const linhas = await listarApuracoesDoMes(mes);
    csv = paraCsv(
      [
        "Colaborador",
        "Papel",
        "Tipo de plano",
        "Base",
        "% aplicado",
        "Comissão",
        "Mês referência",
        "Mês pagamento",
        "Status",
      ],
      linhas.map((l) => [
        l.colaborador.nome,
        LABEL_PAPEL[l.colaborador.papel] ?? l.colaborador.papel,
        l.tipoPlano,
        Number(l.valorBase).toFixed(2).replace(".", ","),
        l.percentualAplicado !== null
          ? Number(l.percentualAplicado).toFixed(4).replace(".", ",")
          : "",
        Number(l.valorComissao).toFixed(2).replace(".", ","),
        mesAnoUTC(l.mesReferencia),
        mesAnoUTC(l.mesPagamento),
        l.status,
      ]),
    );
    nomeArquivo = `comissoes-${mes.slice(0, 7)}.csv`;
  } else if (dataset === "metas") {
    const [metas, colaboradores] = await Promise.all([
      listarMetasMes(mes),
      listarColaboradores(),
    ]);
    const nomePorId = new Map(colaboradores.map((c) => [c.id, c.nome]));
    csv = paraCsv(
      ["Colaborador", "Unidade", "Meta (valor)", "Meta (agendamentos)"],
      metas.map((m) => [
        nomePorId.get(m.colaboradorId) ?? m.colaboradorId,
        m.unidade,
        m.valorMeta !== null ? m.valorMeta.toFixed(2).replace(".", ",") : "",
        m.metaAgendamentos !== null ? m.metaAgendamentos : "",
      ]),
    );
    nomeArquivo = `metas-${mes.slice(0, 7)}.csv`;
  } else {
    return NextResponse.json({ error: "Dataset inválido" }, { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}

function mesCorrenteUTC(): string {
  const agora = new Date();
  const ano = agora.getUTCFullYear();
  const mes = String(agora.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}-01`;
}
