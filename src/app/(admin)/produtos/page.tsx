import { requireRole } from "@/server/auth/session";
import { listarProdutos } from "@/server/repositories/produto.repo";
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
import { ProdutoForm } from "@/app/(admin)/produtos/produto-form";

// Tela admin de produtos/tiers (COLAB-07). Gated por requireRole("ADMIN") —
// o layout (admin) já bloqueia não-admin, mas a checagem aqui é a fronteira
// real de autorização de dados (nunca confiar só no layout).
export default async function ProdutosPage() {
  await requireRole("ADMIN");

  const produtos = await listarProdutos();

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb="Administração › Produtos"
        title="Produtos"
        subtitle="Tiers disponíveis para vendas (ex.: START, PRO, MASTER, PADRAO, Elite)."
        actions={<ProdutoForm mode="criar" />}
      />

      <div className="flex-1 px-6 py-6">
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    Nenhum produto cadastrado ainda.
                  </TableCell>
                </TableRow>
              )}
              {produtos.map((produto) => (
                <TableRow key={produto.id}>
                  <TableCell className="font-medium">
                    {produto.nome}
                  </TableCell>
                  <TableCell>
                    <Badge variant={produto.ativo ? "default" : "secondary"}>
                      {produto.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ProdutoForm
                      mode="editar"
                      produto={{
                        id: produto.id,
                        nome: produto.nome,
                        ativo: produto.ativo,
                        categoria: produto.categoria,
                      }}
                    />
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
