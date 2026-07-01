import { requireRole } from "@/server/auth/session";
import { listarProdutos } from "@/server/repositories/produto.repo";
import { Badge } from "@/components/ui/badge";
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            Tiers disponíveis para vendas (ex.: START, PRO, MASTER, PADRAO,
            Elite).
          </p>
        </div>
        <ProdutoForm mode="criar" />
      </div>

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
              <TableCell className="font-medium">{produto.nome}</TableCell>
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
                  }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
