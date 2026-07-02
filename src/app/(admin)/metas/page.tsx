import { requireRole } from "@/server/auth/session";
import { listarColaboradores } from "@/server/repositories/colaborador.repo";
import { listarMetasMes, getAcompanhamentoMeta } from "@/server/services/meta.service";
import { formatarBRL } from "@/lib/format";
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

import { MetaForm } from "./meta-form";
import { MetasMesSeletor } from "./metas-mes-seletor";
import { ColaboradorAcompanhamentoSeletor } from "./colaborador-acompanhamento-seletor";
import { AcompanhamentoSemanal } from "./acompanhamento-semanal";

// Página /metas (admin) — META-01: define a meta mensal de cada
// colaborador (CLOSER em R$, SDR/SS em nº de agendamentos — unidade
// detectada pelo papel, nunca escolhida no form) e META-03: acompanhamento
// semanal (proporção + realizado + % esperado/atingido/saldo) de um
// colaborador selecionado. Gated por requireRole("ADMIN") PRIMEIRO
// (Pitfall 10).

const LABEL_PAPEL: Record<string, string> = {
  CLOSER: "Closer",
  SDR: "SDR",
  SS: "SS",
};

function mesCorrenteUTC(): string {
  const agora = new Date();
  const ano = agora.getUTCFullYear();
  const mes = String(agora.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}-01`;
}

export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");

  const params = await searchParams;
  const mesParam = Array.isArray(params.mes) ? params.mes[0] : params.mes;
  const mes = mesParam && /^\d{4}-\d{2}-01$/.test(mesParam) ? mesParam : mesCorrenteUTC();

  const [todosColaboradores, metasDoMes] = await Promise.all([
    listarColaboradores(),
    listarMetasMes(mes),
  ]);

  const colaboradoresComMeta = todosColaboradores
    .filter((c) => c.papel === "CLOSER" || c.papel === "SDR" || c.papel === "SS")
    .filter((c) => c.ativo);

  const metaPorColaborador = new Map(metasDoMes.map((m) => [m.colaboradorId, m]));

  const colaboradorIdParam = Array.isArray(params.colaboradorId)
    ? params.colaboradorId[0]
    : params.colaboradorId;
  const colaboradorSelecionadoId =
    colaboradorIdParam ?? colaboradoresComMeta[0]?.id ?? null;

  const acompanhamento = colaboradorSelecionadoId
    ? await getAcompanhamentoMeta(colaboradorSelecionadoId, mes)
    : null;

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb="Administração › Metas"
        title="Metas"
        subtitle="Meta mensal por colaborador, quebrada em proporção semanal acumulada."
        actions={<MetasMesSeletor mes={mes} />}
      />

      <div className="flex-1 space-y-4 px-6 py-6">
        <Card className="overflow-hidden py-0">
          <div className="px-6 py-4">
            <p className="text-sm font-medium">Metas do mês</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Meta definida</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colaboradoresComMeta.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum colaborador CLOSER/SDR/SS ativo cadastrado ainda.
                  </TableCell>
                </TableRow>
              )}
              {colaboradoresComMeta.map((colaborador) => {
                const unidade = colaborador.papel === "CLOSER" ? "VALOR" : "AGENDAMENTOS";
                const meta = metaPorColaborador.get(colaborador.id) ?? null;
                const metaAtual =
                  meta?.unidade === "VALOR"
                    ? meta.valorMeta
                    : (meta?.metaAgendamentos ?? null);

                return (
                  <TableRow key={colaborador.id}>
                    <TableCell className="font-medium">{colaborador.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {LABEL_PAPEL[colaborador.papel] ?? colaborador.papel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {unidade === "VALOR" ? "R$" : "Agendamentos"}
                    </TableCell>
                    <TableCell>
                      {metaAtual !== null
                        ? unidade === "VALOR"
                          ? formatarBRL(metaAtual)
                          : `${metaAtual} agend.`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <MetaForm
                        colaboradorId={colaborador.id}
                        colaboradorNome={colaborador.nome}
                        unidade={unidade}
                        metaAtual={metaAtual}
                        mesReferenciaAtual={mes}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Acompanhamento semanal (META-03)</p>
            {colaboradorSelecionadoId && (
              <ColaboradorAcompanhamentoSeletor
                colaboradores={colaboradoresComMeta.map((c) => ({
                  id: c.id,
                  nome: c.nome,
                  papel: c.papel,
                }))}
                selecionadoId={colaboradorSelecionadoId}
                mes={mes}
              />
            )}
          </div>

          {acompanhamento ? (
            <AcompanhamentoSemanal acompanhamento={acompanhamento} />
          ) : (
            <Card className="px-6 py-4 text-sm text-muted-foreground">
              Nenhum colaborador para acompanhar ainda.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
