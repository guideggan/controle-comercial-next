import { requireUser, requireSelfOrAdmin } from "@/server/auth/session";
import { listarColaboradores } from "@/server/repositories/colaborador.repo";
import {
  listarAgendamentos,
  getGridSemanaCorrente,
} from "@/server/services/agendamento.service";
import { AppTopbar } from "@/components/shell/app-topbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { AgendamentoForm } from "./agendamento-form";
import { AgendamentoStatusSelect } from "./agendamento-status-select";
import { ColaboradorSeletor } from "./colaborador-seletor";

// Página /agendamentos (AGEND-01/02/03) — vive em (colaborador) porque o
// layout desse grupo usa requireUser() (qualquer papel autenticado), o
// grupo (admin) exige ADMIN e redirecionaria SDR/SS para /login. ADMIN
// também acessa esta rota normalmente (getNavSections adiciona o item na
// seção OPERAÇÃO para o papel ADMIN).
//
// Autorização real (AUTH-03/Pitfall 1/IDOR): um SDR/SS só enxerga os
// PRÓPRIOS agendamentos — o colaboradorId usado em toda leitura/escrita
// vem SEMPRE da sessão (user.colaboradorId), nunca de searchParams, exceto
// quando o papel é ADMIN (que pode escolher explicitamente via
// ?colaboradorId=, sempre revalidado por requireSelfOrAdmin no server).

const LABEL_STATUS: Record<string, string> = {
  AGENDADO: "Agendado",
  REALIZADO: "Realizado",
  NO_SHOW: "No-show",
  CANCELADO: "Cancelado",
};

const DIA_SEMANA_LABEL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function formatarDataBR(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default async function AgendamentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const isAdmin = user.role === "ADMIN";

  let colaboradorAlvoId: string | null = user.colaboradorId ?? null;
  let colaboradoresSdrSs: { id: string; nome: string; papel: string }[] = [];

  if (isAdmin) {
    const todos = await listarColaboradores();
    colaboradoresSdrSs = todos
      .filter((c) => c.papel === "SDR" || c.papel === "SS")
      .map((c) => ({ id: c.id, nome: c.nome, papel: c.papel }));

    const colaboradorIdParam = Array.isArray(params.colaboradorId)
      ? params.colaboradorId[0]
      : params.colaboradorId;

    colaboradorAlvoId =
      colaboradorIdParam ?? colaboradoresSdrSs[0]?.id ?? null;
  }

  if (!colaboradorAlvoId) {
    return (
      <div className="flex flex-1 flex-col">
        <AppTopbar
          breadcrumb="Operação › Agendamentos"
          title="Agendamentos"
        />
        <div className="flex-1 px-6 py-6">
          <Card className="px-6 py-4 text-sm text-muted-foreground">
            {isAdmin
              ? "Nenhum colaborador SDR/SS cadastrado ainda."
              : "Sua conta não está vinculada a um colaborador."}
          </Card>
        </div>
      </div>
    );
  }

  // Reafirma a autorização no server (Pitfall 1/IDOR): mesmo vindo da
  // querystring escolhida pelo ADMIN, o alvo passa SEMPRE por
  // requireSelfOrAdmin antes de qualquer leitura.
  await requireSelfOrAdmin(colaboradorAlvoId);

  const hoje = new Date();
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth(); // 0-indexed
  const dataInicioMes = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  // Último dia real do mês (Date.UTC com dia 0 do mês seguinte) — nunca
  // "-31" fixo, que rolaria para o mês seguinte em meses curtos (Pitfall 6,
  // mesmo cuidado de listarAgendamentosDoMes no repo).
  const ultimoDiaMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const dataFimMes = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;

  const [grid, agendamentosDoMes] = await Promise.all([
    getGridSemanaCorrente(colaboradorAlvoId),
    listarAgendamentos(colaboradorAlvoId, dataInicioMes, dataFimMes),
  ]);

  const totalAgendadasSemana = grid.dias.reduce((s, d) => s + d.agendadas, 0);
  const totalRealizadasSemana = grid.dias.reduce((s, d) => s + d.realizadas, 0);

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb="Operação › Agendamentos"
        title="Agendamentos"
        subtitle="Registre agendamentos e acompanhe agendadas x realizadas da semana."
        actions={
          isAdmin ? (
            <ColaboradorSeletor
              colaboradores={colaboradoresSdrSs}
              selecionadoId={colaboradorAlvoId}
            />
          ) : undefined
        }
      />

      <div className="flex-1 space-y-4 px-6 py-6">
        <AgendamentoForm colaboradorId={colaboradorAlvoId} />

        <Card className="overflow-hidden py-0">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium">
                Semana corrente ({formatarDataBR(grid.inicioSemana)} a{" "}
                {formatarDataBR(grid.fimSemana)})
              </p>
              <p className="text-xs text-muted-foreground">
                Agendadas x realizadas por dia (segunda a sábado)
              </p>
            </div>
            <Badge variant="outline">
              {totalRealizadasSemana}/{totalAgendadasSemana} realizadas na semana
            </Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dia</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Agendadas</TableHead>
                <TableHead>Realizadas</TableHead>
                <TableHead>No-show</TableHead>
                <TableHead>Canceladas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grid.dias.map((dia, index) => (
                <TableRow key={dia.data}>
                  <TableCell className="font-medium">
                    {DIA_SEMANA_LABEL[index]}
                  </TableCell>
                  <TableCell>{formatarDataBR(dia.data)}</TableCell>
                  <TableCell>{dia.agendadas}</TableCell>
                  <TableCell>{dia.realizadas}</TableCell>
                  <TableCell>{dia.noShow}</TableCell>
                  <TableCell>{dia.cancelado}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="overflow-hidden py-0">
          <div className="px-6 py-4">
            <p className="text-sm font-medium">Agendamentos do mês</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agendamentosDoMes.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    Nenhum agendamento registrado neste mês ainda.
                  </TableCell>
                </TableRow>
              )}
              {agendamentosDoMes.map((ag) => (
                <TableRow key={ag.id}>
                  <TableCell>{formatarDataBR(ag.data)}</TableCell>
                  <TableCell>
                    <AgendamentoStatusSelect
                      agendamentoId={ag.id}
                      status={ag.status}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ag.observacao || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <p className="text-xs text-muted-foreground">
          {LABEL_STATUS.REALIZADO} é a única contagem usada tanto na apuração
          de comissão por calls quanto neste painel — fonte única de dados
          (AGEND-02).
        </p>
      </div>
    </div>
  );
}
