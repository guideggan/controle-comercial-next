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

// Tela admin de gestão de contas de colaborador (AUTH-05). Gated por
// requireRole("ADMIN") — o layout (admin) já bloqueia não-admin, mas a
// checagem aqui é a fronteira real de autorização de dados (nunca confiar
// só no layout), mesmo padrão de produtos/page.tsx.
export default async function ColaboradoresPage() {
  await requireRole("ADMIN");

  const colaboradores = await listarColaboradores();

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb="Administração › Colaboradores"
        title="Colaboradores"
        subtitle="Contas de acesso do time (papel, contato/PIX e status)."
        actions={<ColaboradorForm />}
      />

      <div className="flex-1 px-6 py-6">
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
                      {colaborador.ativo ? "Ativo" : "Inativo"}
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
