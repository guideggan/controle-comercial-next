import { formatarBRL } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExtratoLinha } from "@/server/services/apuracao.service";

// Extrato de comissão linha a linha (PAINEL-03/COMIS-07) — versão
// self-service do colaborador, mesmo formato visual do extrato ADMIN
// (comissoes/[colaboradorId]/page.tsx), porém sempre alimentada com o
// colaboradorId da PRÓPRIA sessão (nunca da URL).

const LABEL_TIPO_PARCELA: Record<string, string> = {
  ENTRADA: "Entrada",
  MENSALIDADE: "Mensalidade",
  AVISTA: "À vista",
};

function formatarDataUTC(data: Date): string {
  const dia = String(data.getUTCDate()).padStart(2, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const ano = data.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatarMesAnoISO(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split("-");
  return `${mes}/${ano}`;
}

export function ExtratoTabela({ linhas }: { linhas: ExtratoLinha[] }) {
  const total = linhas.reduce((soma, l) => soma + l.valorRecebido, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Extrato — linha a linha</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Pago em</TableHead>
              <TableHead>Valor recebido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhuma parcela recebida nesta competência.
                </TableCell>
              </TableRow>
            )}
            {linhas.map((linha) => (
              <TableRow key={linha.parcelaId}>
                <TableCell>{linha.alunoNome}</TableCell>
                <TableCell>{LABEL_TIPO_PARCELA[linha.tipo] ?? linha.tipo}</TableCell>
                <TableCell>
                  {linha.dataPagamento ? formatarDataUTC(linha.dataPagamento) : "-"}
                </TableCell>
                <TableCell>{formatarBRL(linha.valorRecebido)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {linhas.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">
                  Total de {formatarMesAnoISO(linhas[0].mesReferencia)}
                </TableCell>
                <TableCell className="font-medium">{formatarBRL(total)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </CardContent>
    </Card>
  );
}
