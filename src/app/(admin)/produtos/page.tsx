import type { CategoriaProduto } from "@prisma/client";

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
import { ProdutoCategoriaFiltro } from "@/app/(admin)/produtos/produto-categoria-filtro";

// Tela admin de produtos/tiers (COLAB-07). Gated por requireRole("ADMIN") —
// o layout (admin) já bloqueia não-admin, mas a checagem aqui é a fronteira
// real de autorização de dados (nunca confiar só no layout).
//
// v1.1: agrupamento visual por categoria (ACELERACAO_MENTORIA/
// IMERSAO_PRESENCIAL/EVENTO_PRESENCIAL) + filtro opcional via ?categoria= —
// produtos históricos sem categoria (Fase 10) caem num grupo "Sem
// categoria" à parte, nunca escondidos.

const CATEGORIA_LABEL: Record<CategoriaProduto, string> = {
  ACELERACAO_MENTORIA: "Aceleração / Mentoria",
  IMERSAO_PRESENCIAL: "Imersão presencial",
  EVENTO_PRESENCIAL: "Evento presencial",
};

const ORDEM_CATEGORIAS: CategoriaProduto[] = [
  "ACELERACAO_MENTORIA",
  "IMERSAO_PRESENCIAL",
  "EVENTO_PRESENCIAL",
];

const SEM_CATEGORIA_LABEL = "Sem categoria (histórico)";

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");

  const params = await searchParams;
  const categoriaParam = Array.isArray(params.categoria)
    ? params.categoria[0]
    : params.categoria;
  const categoriaFiltro =
    categoriaParam && ORDEM_CATEGORIAS.includes(categoriaParam as CategoriaProduto)
      ? (categoriaParam as CategoriaProduto)
      : categoriaParam === "SEM_CATEGORIA"
        ? "SEM_CATEGORIA"
        : null;

  const todosProdutos = await listarProdutos();

  const produtos = categoriaFiltro
    ? todosProdutos.filter((p) =>
        categoriaFiltro === "SEM_CATEGORIA"
          ? !p.categoria
          : p.categoria === categoriaFiltro,
      )
    : todosProdutos;

  // Agrupa por categoria (ordem fixa) + um grupo final para produtos sem
  // categoria — só exibido se houver algum.
  const grupos: { chave: string; label: string; produtos: typeof produtos }[] =
    ORDEM_CATEGORIAS.map((categoria) => ({
      chave: categoria,
      label: CATEGORIA_LABEL[categoria],
      produtos: produtos.filter((p) => p.categoria === categoria),
    })).filter((g) => g.produtos.length > 0);

  const semCategoria = produtos.filter((p) => !p.categoria);
  if (semCategoria.length > 0) {
    grupos.push({
      chave: "SEM_CATEGORIA",
      label: SEM_CATEGORIA_LABEL,
      produtos: semCategoria,
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb="Administração › Produtos"
        title="Produtos"
        subtitle="Tiers disponíveis para vendas, agrupados por categoria."
        actions={<ProdutoForm mode="criar" />}
      />

      <div className="flex-1 space-y-4 px-6 py-6">
        <ProdutoCategoriaFiltro
          categoriaAtual={categoriaFiltro}
          temSemCategoria={todosProdutos.some((p) => !p.categoria)}
        />

        {grupos.length === 0 && (
          <Card className="px-6 py-4 text-sm text-muted-foreground">
            Nenhum produto encontrado.
          </Card>
        )}

        {grupos.map((grupo) => (
          <Card key={grupo.chave} className="overflow-hidden py-0">
            <div className="px-6 py-4">
              <p className="text-sm font-medium">{grupo.label}</p>
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
                {grupo.produtos.map((produto) => (
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
        ))}
      </div>
    </div>
  );
}
