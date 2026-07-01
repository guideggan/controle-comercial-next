import Link from "next/link";

import { requireRole } from "@/server/auth/session";
import { listarVendas } from "@/server/repositories/venda.repo";
import type { ListarVendasFiltros } from "@/server/repositories/venda.repo";
import { listarProdutos } from "@/server/repositories/produto.repo";
import { listarColaboradores } from "@/server/repositories/colaborador.repo";
import { formatarBRL } from "@/lib/format";
import { AppTopbar } from "@/components/shell/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VendaForm } from "@/app/(admin)/vendas/venda-form";
import { VendasFiltros } from "@/app/(admin)/vendas/vendas-filtros";

// Tela admin de vendas (VENDA-01/VENDA-05). Gated por requireRole("ADMIN") —
// mesma fronteira real de autorização das demais telas admin (nunca confiar
// só no layout (admin)). Filtros chegam via searchParams (fonte da verdade
// é a URL, escrita pelo client component VendasFiltros).
export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");

  const params = await searchParams;

  const primeiro = (valor: string | string[] | undefined) =>
    Array.isArray(valor) ? valor[0] : valor;

  const filtros: ListarVendasFiltros = {};
  const aluno = primeiro(params.aluno);
  const closerId = primeiro(params.closerId);
  const produtoId = primeiro(params.produtoId);
  const status = primeiro(params.status);
  const mesReferencia = primeiro(params.mesReferencia);

  if (aluno) filtros.alunoNome = aluno;
  if (closerId) filtros.closerId = closerId;
  if (produtoId) filtros.produtoId = produtoId;
  if (status === "PENDENTE" || status === "PAGO") {
    filtros.statusPagamento = status;
  }
  if (mesReferencia) filtros.mesReferencia = mesReferencia;

  const [vendas, produtos, colaboradores] = await Promise.all([
    listarVendas(filtros),
    listarProdutos(),
    listarColaboradores(),
  ]);

  const produtosAtivos = produtos.filter((p) => p.ativo);
  const closers = colaboradores.filter(
    (c) => c.ativo && c.papel === "CLOSER",
  );
  const sdrs = colaboradores.filter(
    (c) => c.ativo && (c.papel === "SDR" || c.papel === "SS"),
  );

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb="Operação › Vendas"
        title="Vendas"
        subtitle="Cadastro único de venda — as parcelas são geradas automaticamente."
        actions={
          <VendaForm
            mode="criar"
            produtos={produtosAtivos}
            closers={closers}
            sdrs={sdrs}
          />
        }
      />

      <div className="flex-1 space-y-4 px-6 py-6">
        <VendasFiltros produtos={produtosAtivos} closers={closers} />

        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor total</TableHead>
                <TableHead>Closer</TableHead>
                <TableHead>Mês de referência</TableHead>
                <TableHead>Parcelas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    Nenhuma venda encontrada.
                  </TableCell>
                </TableRow>
              )}
              {vendas.map((venda) => {
                const totalParcelas = venda._count.parcelas;
                return (
                  <TableRow key={venda.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link
                        href={`/vendas/${venda.id}`}
                        className="block hover:underline"
                      >
                        {venda.alunoNome}
                      </Link>
                    </TableCell>
                    <TableCell>{venda.produto.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {venda.tipoPagamento === "A_VISTA"
                          ? "À vista"
                          : "Mensalista"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatarBRL(Number(venda.valorTotal))}
                    </TableCell>
                    <TableCell>{venda.closer.nome}</TableCell>
                    <TableCell>{formatarMesAno(venda.mesReferencia)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {totalParcelas > 0
                        ? `${totalParcelas} parcela${totalParcelas > 1 ? "s" : ""}`
                        : "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

// mesReferencia é DATE puro no Postgres; Prisma devolve `Date` (meia-noite
// UTC). Usa sempre os getters UTC (nunca locais) — mesma convenção de
// timezone-safety de plano-historico.tsx (Pitfall 6).
function formatarMesAno(data: Date): string {
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const ano = data.getUTCFullYear();
  return `${mes}/${ano}`;
}
