import type { PlanoComissao } from "@prisma/client";

import { formatarBRL, formatarPercentual } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Rótulos pt-BR dos 4 formatos — mesma fonte de tipo do plano-form.tsx.
const LABEL_TIPO: Record<PlanoComissao["tipo"], string> = {
  percentual_fixo: "% fixo",
  progressivo_atingimento: "Progressivo por atingimento",
  fixo_variavel: "Fixo + variável",
  por_calls: "Por calls",
};

// Formata a `config` (JSONB) de um plano em um resumo curto pt-BR, usando os
// helpers de exibição (nunca reformata para persistir — só para exibir).
function resumoConfig(plano: PlanoComissao): string {
  const config = plano.config as Record<string, unknown>;

  switch (plano.tipo) {
    case "percentual_fixo":
      return formatarPercentual(config.percentual as number);
    case "progressivo_atingimento": {
      const faixas = config.faixas as {
        deAtingimento: number;
        percentual: number;
      }[];
      return faixas
        .map(
          (faixa) =>
            `a partir de ${formatarPercentual(faixa.deAtingimento)}: ${formatarPercentual(faixa.percentual)}`,
        )
        .join(" · ");
    }
    case "fixo_variavel":
      return `${formatarBRL(config.valorFixo as number)} + ${formatarPercentual(config.percentualVariavel as number)}`;
    case "por_calls":
      return `${formatarBRL(config.valorPorCall as number)} por call`;
    default:
      return "-";
  }
}

// PlanoComissao.vigenciaInicio/vigenciaFim são DATE puro no Postgres; o
// Prisma os lê de volta como `Date` (meia-noite UTC). Formatamos usando
// SEMPRE os getters UTC (getUTCMonth/getUTCFullYear), nunca os locais —
// mesma convenção de timezone-safety do service (Pitfall 6): usar getters
// locais aqui poderia exibir o mês anterior dependendo do fuso do processo.
function formatarMesAno(data: Date): string {
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const ano = data.getUTCFullYear();
  return `${mes}/${ano}`;
}

// Tabela de histórico de vigências (COLAB-06) — recebida por prop já
// ordenada (mais recente primeiro, ver listarPlanosDoColaborador). A linha
// com vigenciaFim null é a vigente.
export function PlanoHistorico({ planos }: { planos: PlanoComissao[] }) {
  if (planos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum plano de comissão configurado ainda.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Formato</TableHead>
          <TableHead>Início</TableHead>
          <TableHead>Fim</TableHead>
          <TableHead>Configuração</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {planos.map((plano) => (
          <TableRow key={plano.id}>
            <TableCell className="font-medium">
              {LABEL_TIPO[plano.tipo]}
            </TableCell>
            <TableCell>{formatarMesAno(plano.vigenciaInicio)}</TableCell>
            <TableCell>
              {plano.vigenciaFim ? (
                formatarMesAno(plano.vigenciaFim)
              ) : (
                <Badge variant="default">Vigente</Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {resumoConfig(plano)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
