import Link from "next/link";

import { requireRole } from "@/server/auth/session";
import { listarVendasPendentesAprovacao } from "@/server/services/venda.service";
import { formatarBRL } from "@/lib/format";
import { AppTopbar } from "@/components/shell/app-topbar";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { AprovacaoAcoes } from "@/app/(admin)/vendas/pendentes/aprovacao-acoes";

// Fila de aprovação do admin (v1.1, VENDA-11): vendas cadastradas por um
// CLOSER, ainda não decididas. Gated por requireRole("ADMIN") PRIMEIRO —
// nenhuma leitura antes dessa checagem (Pitfall 10, mesmo padrão de todas
// as demais telas admin). Lista já vem ordenada FIFO (mais antiga primeiro)
// pelo repo.

function formatarDataUTC(data: Date): string {
  const dia = String(data.getUTCDate()).padStart(2, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const ano = data.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

export default async function VendasPendentesPage() {
  await requireRole("ADMIN");

  const vendas = await listarVendasPendentesAprovacao();

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb="Operação › Vendas › Fila de aprovação"
        title="Fila de aprovação"
        subtitle="Vendas cadastradas por closers, aguardando decisão do admin."
        actions={
          <Link
            href="/vendas"
            className="text-sm font-medium hover:underline"
          >
            Voltar para Vendas
          </Link>
        }
      />

      <div className="flex-1 px-6 py-6">
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Valor total</TableHead>
                <TableHead>Closer</TableHead>
                <TableHead>Criada por</TableHead>
                <TableHead>Link do CRM</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    Nenhuma venda pendente de aprovação.
                  </TableCell>
                </TableRow>
              )}
              {vendas.map((venda) => (
                <TableRow key={venda.id}>
                  <TableCell>{formatarDataUTC(venda.dataVenda)}</TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/vendas/${venda.id}`}
                      className="hover:underline"
                    >
                      {venda.alunoNome}
                    </Link>
                  </TableCell>
                  <TableCell>{venda.produto.nome}</TableCell>
                  <TableCell>
                    {formatarBRL(Number(venda.valorTotal))}
                  </TableCell>
                  <TableCell>{venda.closer.nome}</TableCell>
                  <TableCell>{venda.criadaPor?.nome ?? "-"}</TableCell>
                  <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                    {venda.linkCrm || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <AprovacaoAcoes vendaId={venda.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
