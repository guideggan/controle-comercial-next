import { formatarBRL, formatarPercentual } from "@/lib/format";
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
import type { AcompanhamentoMeta } from "@/server/services/meta.service";

// Tabela de acompanhamento semanal (META-03) — Server Component puro
// (só renderiza o que getAcompanhamentoMeta já calculou), reutilizável tal
// qual pelo painel do colaborador na Fase 8 (mesma função de service, mesmo
// componente de exibição).

function formatarValor(valor: number, unidade: "VALOR" | "AGENDAMENTOS" | null) {
  if (unidade === "AGENDAMENTOS") return `${valor} agend.`;
  return formatarBRL(valor);
}

function formatarDataBR(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function AcompanhamentoSemanal({
  acompanhamento,
}: {
  acompanhamento: AcompanhamentoMeta;
}) {
  const { unidade, metaMensal, realizadoMes, semanas } = acompanhamento;

  if (metaMensal <= 0) {
    return (
      <Card className="px-6 py-4 text-sm text-muted-foreground">
        Nenhuma meta definida para este colaborador neste mês ainda.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden py-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <p className="text-sm font-medium">
            Meta mensal: {formatarValor(metaMensal, unidade)}
          </p>
          <p className="text-xs text-muted-foreground">
            Realizado no mês (até hoje): {formatarValor(realizadoMes, unidade)}
          </p>
        </div>
        <Badge variant={realizadoMes >= metaMensal ? "default" : "secondary"}>
          {formatarPercentual(metaMensal > 0 ? realizadoMes / metaMensal : 0)} da meta
        </Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Semana</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Meta proporcional acum.</TableHead>
            <TableHead>Realizado acum.</TableHead>
            <TableHead>% esperado</TableHead>
            <TableHead>% atingido</TableHead>
            <TableHead>Saldo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {semanas.map((semana) => (
            <TableRow key={semana.numero}>
              <TableCell className="font-medium">Semana {semana.numero}</TableCell>
              <TableCell>
                {formatarDataBR(semana.inicio)} a {formatarDataBR(semana.fim)}
              </TableCell>
              <TableCell>
                {formatarValor(semana.metaProporcionalAcumulada, unidade)}
              </TableCell>
              <TableCell>
                {formatarValor(semana.realizadoAcumulado, unidade)}
              </TableCell>
              <TableCell>{formatarPercentual(semana.percentualEsperado)}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    semana.percentualAtingido >= semana.percentualEsperado
                      ? "default"
                      : "secondary"
                  }
                >
                  {formatarPercentual(semana.percentualAtingido)}
                </Badge>
              </TableCell>
              <TableCell
                className={semana.saldo > 0 ? "text-muted-foreground" : "font-medium"}
              >
                {semana.saldo > 0 ? "-" : "+"}
                {formatarValor(Math.abs(semana.saldo), unidade)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
