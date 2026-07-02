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
import type { SemanaCorrenteGrid } from "@/server/services/agendamento.service";

// Painel agendadas x realizadas da semana corrente (PAINEL-04/AGEND-03) —
// mesmo grid visual de /agendamentos, embutido no painel self-service do
// SDR/SS. Recebe o grid já calculado por getGridSemanaCorrente (nunca
// recalcula aqui).

const DIA_SEMANA_LABEL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function formatarDataBR(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function AgendamentosGrid({ grid }: { grid: SemanaCorrenteGrid }) {
  const totalAgendadas = grid.dias.reduce((s, d) => s + d.agendadas, 0);
  const totalRealizadas = grid.dias.reduce((s, d) => s + d.realizadas, 0);

  return (
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
          {totalRealizadas}/{totalAgendadas} realizadas na semana
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
              <TableCell className="font-medium">{DIA_SEMANA_LABEL[index]}</TableCell>
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
  );
}
