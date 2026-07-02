import Link from "next/link";

import { requireRole } from "@/server/auth/session";
import { listarColaboradores } from "@/server/repositories/colaborador.repo";
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
import { ColaboradorForm } from "@/app/(admin)/colaboradores/colaborador-form";
import { ColaboradorActions } from "@/app/(admin)/colaboradores/colaborador-actions";
import { MostrarArquivadosToggle } from "@/app/(admin)/colaboradores/mostrar-arquivados-toggle";

// Tela admin de gestão de contas de colaborador (AUTH-05). Gated por
// requireRole("ADMIN") — o layout (admin) já bloqueia não-admin, mas a
// checagem aqui é a fronteira real de autorização de dados (nunca confiar
// só no layout), mesmo padrão de produtos/page.tsx.
//
// v1.1: colaboradores arquivados (ativo=false) ficam ESCONDIDOS por padrão
// — só aparecem com ?arquivados=1 na URL (mesma convenção de filtro via
// querystring do resto do app, ex.: vendas-filtros.tsx).
export default async function ColaboradoresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");

  const params = await searchParams;
  const arquivadosParam = Array.isArray(params.arquivados)
    ? params.arquivados[0]
    : params.arquivados;
  const mostrarArquivados = arquivadosParam === "1";

  const todosColaboradores = await listarColaboradores();
  const colaboradores = mostrarArquivados
    ? todosColaboradores
    : todosColaboradores.filter((c) => c.ativo);
  const totalArquivados = todosColaboradores.filter((c) => !c.ativo).length;

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb="Administração › Colaboradores"
        title="Colaboradores"
        subtitle="Contas de acesso do time (papel, contato/PIX e status)."
        actions={<ColaboradorForm />}
      />

      <div className="flex-1 space-y-4 px-6 py-6">
        <MostrarArquivadosToggle
          mostrarArquivados={mostrarArquivados}
          totalArquivados={totalArquivados}
        />

        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colaboradores.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    Nenhum colaborador cadastrado ainda.
                  </TableCell>
                </TableRow>
              )}
              {colaboradores.map((colaborador) => (
                <TableRow key={colaborador.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/colaboradores/${colaborador.id}`}
                      className="hover:underline"
                    >
                      {colaborador.nome}
                    </Link>
                  </TableCell>
                  <TableCell>{colaborador.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{colaborador.papel}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={colaborador.ativo ? "default" : "secondary"}
                    >
                      {colaborador.ativo ? "Ativo" : "Arquivado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ColaboradorActions
                      colaborador={{
                        id: colaborador.id,
                        nome: colaborador.nome,
                        ativo: colaborador.ativo,
                        temContaVinculada: Boolean(colaborador.user?.id),
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
