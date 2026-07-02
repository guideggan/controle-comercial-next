import Link from "next/link";

import { requireRole } from "@/server/auth/session";
import { listarApuracoesDoMes } from "@/server/services/apuracao.service";
import { formatarBRL, formatarPercentual } from "@/lib/format";
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
import { ComissoesMesSeletor } from "@/app/(admin)/comissoes/comissoes-mes-seletor";
import { ApuracaoAcoes } from "@/app/(admin)/comissoes/apuracao-acoes";

// Página de Apuração/Comissões (admin) — COMIS-05/06: LÊ o snapshot
// comissao_apurada via listarApuracoesDoMes (nunca recalcula ao vivo,
// Anti-Pattern 1). Gated por requireRole("ADMIN") PRIMEIRO (Pitfall 10).

const LABEL_PAPEL: Record<string, string> = {
  ADMIN: "Admin",
  CLOSER: "Closer",
  SDR: "SDR",
  SS: "SS",
};

const LABEL_TIPO_PLANO: Record<string, string> = {
  percentual_fixo: "Percentual fixo",
  progressivo_atingimento: "Progressivo por atingimento",
  fixo_variavel: "Fixo + variável",
  por_calls: "Por calls",
};

// Mês corrente como "YYYY-MM-01", timezone-safe (getters UTC do instante
// atual do processo) — mesma convenção de vendas-filtros.tsx/Pitfall 6.
function mesCorrenteUTC(): string {
  const agora = new Date();
  const ano = agora.getUTCFullYear();
  const mes = String(agora.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}-01`;
}

function formatarMesAnoUTC(data: Date): string {
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const ano = data.getUTCFullYear();
  return `${mes}/${ano}`;
}

export default async function ComissoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");

  const params = await searchParams;
  const mesParam = Array.isArray(params.mes) ? params.mes[0] : params.mes;
  const mes = mesParam && /^\d{4}-\d{2}-01$/.test(mesParam) ? mesParam : mesCorrenteUTC();

  const linhas = await listarApuracoesDoMes(mes);

  const totalGeral = linhas.reduce(
    (soma, linha) => soma + Number(linha.valorComissao),
    0,
  );
  const algumaFechada = linhas.some((linha) => linha.status === "FECHADA");

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb="Operação › Comissões"
        title="Comissões"
        subtitle="Apuração mensal lida direto do snapshot — o motor nunca recalcula na tela."
        actions={<ComissoesMesSeletor mes={mes} />}
      />

      <div className="flex-1 space-y-4 px-6 py-6">
        <ApuracaoAcoes
          mes={mes}
          fechado={algumaFechada}
          temApuracao={linhas.length > 0}
        />

        <Card className="flex flex-row items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs text-muted-foreground">
              Total de comissão apurada no mês
            </p>
            <p className="text-lg font-semibold">{formatarBRL(totalGeral)}</p>
          </div>
          <Badge variant={algumaFechada ? "default" : "secondary"}>
            {algumaFechada ? "Mês fechado" : "Mês aberto"}
          </Badge>
        </Card>

        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Tipo de plano</TableHead>
                <TableHead>Base</TableHead>
                <TableHead>% aplicado</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Mês pgto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Extrato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground"
                  >
                    Nenhuma apuração para este mês ainda. Clique em
                    &quot;Apurar mês&quot; para calcular.
                  </TableCell>
                </TableRow>
              )}
              {linhas.map((linha) => (
                <TableRow key={linha.id}>
                  <TableCell className="font-medium">
                    {linha.colaborador.nome}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {LABEL_PAPEL[linha.colaborador.papel] ??
                        linha.colaborador.papel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {LABEL_TIPO_PLANO[linha.tipoPlano] ?? linha.tipoPlano}
                  </TableCell>
                  <TableCell>
                    {linha.tipoPlano === "por_calls"
                      ? `${Number(linha.valorBase)} calls`
                      : formatarBRL(Number(linha.valorBase))}
                  </TableCell>
                  <TableCell>
                    {linha.percentualAplicado !== null
                      ? formatarPercentual(Number(linha.percentualAplicado))
                      : "-"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatarBRL(Number(linha.valorComissao))}
                  </TableCell>
                  <TableCell>{formatarMesAnoUTC(linha.mesPagamento)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        linha.status === "FECHADA" ? "default" : "secondary"
                      }
                    >
                      {linha.status === "FECHADA" ? "Fechada" : "Aberta"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/comissoes/${linha.colaboradorId}?mes=${mes}`}
                      className="text-sm font-medium hover:underline"
                    >
                      Ver extrato
                    </Link>
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
