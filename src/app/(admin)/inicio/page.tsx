import { requireRole } from "@/server/auth/session";
import { getDashboardConsolidado } from "@/server/services/dashboard.service";
import { formatarBRL, formatarPercentual } from "@/lib/format";
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

import { InicioMesSeletor } from "./inicio-mes-seletor";
import { ExportarRelatorio } from "./exportar-relatorio";
import { ReceitaChart } from "./receita-chart";

// Dashboard do Gestor (Fase 9 — GESTOR-01/02/03/04, AUDIT-02): visão
// consolidada por mês de receita, contagem por produto, comissão por
// colaborador (referência x pagamento) e atingimento de meta de todo o
// time, num único lugar — mirando o estilo "DRE Consolidado" (topbar com
// título grande + seletor de mês + botão preto "Exportar relatório", cards
// brancos arredondados, gráfico de área). Gated por requireRole("ADMIN")
// PRIMEIRO (Pitfall 10). Toda leitura vem de fachadas de service já
// existentes (recebidoNoMes, listarVendas, listarApuracoesDoMes —
// snapshot, getAcompanhamentoMeta) — nenhum cálculo de comissão é refeito
// aqui (Anti-Pattern 1).

const LABEL_PAPEL: Record<string, string> = {
  ADMIN: "Admin",
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

export default async function InicioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");

  const params = await searchParams;
  const mesParam = Array.isArray(params.mes) ? params.mes[0] : params.mes;
  const mes = mesParam && /^\d{4}-\d{2}-01$/.test(mesParam) ? mesParam : mesCorrenteUTC();

  const dashboard = await getDashboardConsolidado(mes);

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb="Operação › Início"
        title="Início"
        subtitle="Visão consolidada da operação comercial do mês selecionado."
        actions={
          <>
            <InicioMesSeletor mes={mes} />
            <ExportarRelatorio mes={mes} />
          </>
        }
      />

      <div className="flex-1 space-y-4 px-6 py-6">
        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="gap-1 px-6 py-4">
            <p className="text-xs text-muted-foreground">Receita total</p>
            <p className="text-2xl font-semibold">
              {formatarBRL(dashboard.receita.total)}
            </p>
          </Card>
          <Card className="gap-1 px-6 py-4">
            <p className="text-xs text-muted-foreground">Receita à vista</p>
            <p className="text-2xl font-semibold">
              {formatarBRL(dashboard.receita.avista)}
            </p>
          </Card>
          <Card className="gap-1 px-6 py-4">
            <p className="text-xs text-muted-foreground">Receita mensalista</p>
            <p className="text-2xl font-semibold">
              {formatarBRL(dashboard.receita.mensalista)}
            </p>
          </Card>
          <Card className="gap-1 px-6 py-4">
            <p className="text-xs text-muted-foreground">Nº de vendas</p>
            <p className="text-2xl font-semibold">{dashboard.numeroVendas}</p>
          </Card>
          <Card className="gap-1 px-6 py-4">
            <p className="text-xs text-muted-foreground">Comissão total</p>
            <p className="text-2xl font-semibold">
              {formatarBRL(dashboard.comissao.totalGeral)}
            </p>
          </Card>
        </div>

        {/* Chart + contagem por produto */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="gap-2 px-6 py-4 lg:col-span-2">
            <p className="text-sm font-medium">Receita nos últimos meses</p>
            <ReceitaChart pontos={dashboard.serieReceita} />
          </Card>

          <Card className="overflow-hidden py-0">
            <div className="px-6 py-4">
              <p className="text-sm font-medium">Vendas por produto</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.contagemProduto.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      Nenhuma venda neste mês.
                    </TableCell>
                  </TableRow>
                )}
                {dashboard.contagemProduto.map((linha) => (
                  <TableRow key={linha.produtoNome}>
                    <TableCell className="font-medium">{linha.produtoNome}</TableCell>
                    <TableCell className="text-right">{linha.quantidade}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Comissão por colaborador */}
        <Card className="overflow-hidden py-0">
          <div className="flex items-center justify-between px-6 py-4">
            <p className="text-sm font-medium">Comissão por colaborador</p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Closers: {formatarBRL(dashboard.comissao.totalCloser)}</span>
              <span>SDR/SS: {formatarBRL(dashboard.comissao.totalSdrSs)}</span>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Mês referência</TableHead>
                <TableHead>Mês pagamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.comissao.linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhuma comissão apurada neste mês ainda.
                  </TableCell>
                </TableRow>
              )}
              {dashboard.comissao.linhas.map((linha) => (
                <TableRow key={linha.colaboradorId}>
                  <TableCell className="font-medium">{linha.colaboradorNome}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {LABEL_PAPEL[linha.papel] ?? linha.papel}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatarBRL(linha.valorComissao)}
                  </TableCell>
                  <TableCell>{formatarMesAno(linha.mesReferencia)}</TableCell>
                  <TableCell>{formatarMesAno(linha.mesPagamento)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Atingimento de meta */}
        <Card className="overflow-hidden py-0">
          <div className="px-6 py-4">
            <p className="text-sm font-medium">Atingimento de meta por colaborador</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Meta</TableHead>
                <TableHead>Realizado</TableHead>
                <TableHead className="text-right">% atingido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.atingimentoMeta.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum colaborador CLOSER/SDR/SS ativo cadastrado ainda.
                  </TableCell>
                </TableRow>
              )}
              {dashboard.atingimentoMeta.map((linha) => (
                <TableRow key={linha.colaboradorId}>
                  <TableCell className="font-medium">{linha.colaboradorNome}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {LABEL_PAPEL[linha.papel] ?? linha.papel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {linha.unidade === "VALOR"
                      ? formatarBRL(linha.metaMensal)
                      : linha.unidade === "AGENDAMENTOS"
                        ? `${linha.metaMensal} agend.`
                        : "-"}
                  </TableCell>
                  <TableCell>
                    {linha.unidade === "VALOR"
                      ? formatarBRL(linha.realizadoMes)
                      : `${linha.realizadoMes} agend.`}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={linha.percentualAtingido >= 1 ? "default" : "secondary"}>
                      {formatarPercentual(linha.percentualAtingido)}
                    </Badge>
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

function formatarMesAno(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split("-");
  return `${mes}/${ano}`;
}
