import { requireRole } from "@/server/auth/session";
import { listarColaboradores } from "@/server/repositories/colaborador.repo";
import { Badge } from "@/components/ui/badge";
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">
            Contas de acesso do time (papel, contato/PIX e status).
          </p>
        </div>
        <ColaboradorForm />
      </div>

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
                {colaborador.nome}
              </TableCell>
              <TableCell>{colaborador.email}</TableCell>
              <TableCell>
                <Badge variant="outline">{colaborador.papel}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={colaborador.ativo ? "default" : "secondary"}>
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
    </div>
  );
}
