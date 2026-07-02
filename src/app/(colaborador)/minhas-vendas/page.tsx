import Link from "next/link";

import { requireUser } from "@/server/auth/session";
import { listarMinhasVendasAction } from "@/server/actions/vendas.actions";
import { formatarBRL } from "@/lib/format";
import { AppTopbar } from "@/components/shell/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// "Minhas vendas" do CLOSER (v1.1, VENDA-11) — só as próprias vendas
// (listarMinhasVendasAction força closerId = sessão, nunca aceita input do
// client). Página só lê; decisão de aprovar/rejeitar é exclusiva do admin.

const STATUS_APROVACAO_LABEL: Record<string, string> = {
  PENDENTE_APROVACAO: "Pendente de aprovação",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
};

function statusAprovacaoVariant(
  status: string,
): "default" | "secondary" | "destructive" {
  if (status === "APROVADA") return "default";
  if (status === "REJEITADA") return "destructive";
  return "secondary";
}

function formatarMesAno(data: Date): string {
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const ano = data.getUTCFullYear();
  return `${mes}/${ano}`;
}

export default async function MinhasVendasPage() {
  const user = await requireUser();

  if (user.role !== "CLOSER") {
    return (
      <div className="flex flex-1 flex-col">
        <AppTopbar breadcrumb="Operação › Minhas vendas" title="Minhas vendas" />
        <div className="flex-1 px-6 py-6">
          <Card className="px-6 py-4 text-sm text-muted-foreground">
            Esta tela é exclusiva para closers.
          </Card>
        </div>
      </div>
    );
  }

  const vendas = await listarMinhasVendasAction();

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb="Operação › Minhas vendas"
        title="Minhas vendas"
        subtitle="Vendas que você cadastrou, com o status de aprovação do admin."
        actions={
          <Link href="/minhas-vendas/nova">
            <Button type="button" size="sm">
              Nova venda
            </Button>
          </Link>
        }
      />

      <div className="flex-1 px-6 py-6">
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Valor total</TableHead>
                <TableHead>Mês de referência</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    Você ainda não cadastrou nenhuma venda.
                  </TableCell>
                </TableRow>
              )}
              {vendas.map((venda) => {
                const totalParcelas = venda._count.parcelas;
                return (
                  <TableRow key={venda.id}>
                    <TableCell className="font-medium">
                      {venda.alunoNome}
                    </TableCell>
                    <TableCell>{venda.produto.nome}</TableCell>
                    <TableCell>
                      {formatarBRL(Number(venda.valorTotal))}
                    </TableCell>
                    <TableCell>{formatarMesAno(venda.mesReferencia)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {totalParcelas > 0
                        ? `${totalParcelas} parcela${totalParcelas > 1 ? "s" : ""}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusAprovacaoVariant(venda.statusAprovacao)}>
                        {STATUS_APROVACAO_LABEL[venda.statusAprovacao] ??
                          venda.statusAprovacao}
                      </Badge>
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
