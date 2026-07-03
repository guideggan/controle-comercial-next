import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/server/auth/session";
import { getExtrato } from "@/server/services/apuracao.service";
import { getColaborador } from "@/server/repositories/colaborador.repo";
import { formatarBRL, formatarPercentual } from "@/lib/format";
import { AppTopbar } from "@/components/shell/app-topbar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ObservacaoApuracaoForm } from "@/app/(admin)/comissoes/[colaboradorId]/observacao-apuracao-form";

// Extrato de comissão por pessoa/mês (COMIS-07) — caminho ADMIN, que aceita
// um colaboradorId vindo da URL: requireRole("ADMIN") PRIMEIRO é obrigatório
// aqui (Anti-Pattern 3/Pitfall 10). O caminho self-service do colaborador
// (derivando o id da sessão, nunca da URL) chega na Fase 8. Página só LÊ o
// snapshot via getExtrato — nunca recalcula (COMIS-05).

const LABEL_TIPO_PARCELA: Record<string, string> = {
  ENTRADA: "Entrada",
  MENSALIDADE: "Mensalidade",
  AVISTA: "À vista",
};

const LABEL_TIPO_PLANO: Record<string, string> = {
  percentual_fixo: "Percentual fixo",
  progressivo_atingimento: "Progressivo por atingimento",
  fixo_variavel: "Fixo + variável",
  por_calls: "Por calls",
  salario_bonus_atingimento: "Salário fixo + bônus por atingimento",
};

// Breakdown salário fixo / bônus / total do formato salario_bonus_atingimento
// (Closer Jr / OTE) — gravado por apuracao.service em
// ComissaoApurada.inputSnapshot.detalhamento (nenhuma coluna nova, COMIS-05).
// `atingimentoPercent`/`faixaEscolhida.minAtingimento` aqui são PERCENTUAL
// inteiro (71 = 71%), NÃO fração — ver comentário de escala em
// planos/salario-bonus-atingimento.ts.
type DetalhamentoSalarioBonus = {
  salarioFixo: number;
  bonus: number;
  total: number;
  atingimentoPercent: number;
  faixaEscolhida: { minAtingimento: number; bonus: number };
};

function extrairDetalhamentoSalarioBonus(
  inputSnapshot: unknown,
): DetalhamentoSalarioBonus | null {
  if (!inputSnapshot || typeof inputSnapshot !== "object") return null;
  const detalhamento = (inputSnapshot as Record<string, unknown>).detalhamento;
  if (!detalhamento || typeof detalhamento !== "object") return null;
  const d = detalhamento as Record<string, unknown>;
  if (typeof d.salarioFixo !== "number" || typeof d.bonus !== "number") {
    return null;
  }
  return d as DetalhamentoSalarioBonus;
}

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

function formatarDataUTC(data: Date): string {
  const dia = String(data.getUTCDate()).padStart(2, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const ano = data.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

// Timestamptz -> exibição em America/Sao_Paulo (instante real, diferente de
// campos @db.Date — aqui o timezone de exibição importa, ao contrário da
// convenção UTC usada para DATE puro).
function formatarInstanteSP(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(data);
}

function montarFormula(
  tipoPlano: string,
  valorBase: number,
  percentualAplicado: number | null,
  valorComissao: number,
  detalhamentoSalarioBonus: DetalhamentoSalarioBonus | null,
): string {
  if (tipoPlano === "por_calls") {
    const valorPorCall = valorBase > 0 ? valorComissao / valorBase : 0;
    return `${valorBase} calls × ${formatarBRL(valorPorCall)} = ${formatarBRL(valorComissao)}`;
  }
  if (tipoPlano === "salario_bonus_atingimento" && detalhamentoSalarioBonus) {
    return `${formatarBRL(detalhamentoSalarioBonus.salarioFixo)} (fixo) + ${formatarBRL(detalhamentoSalarioBonus.bonus)} (bônus, ${detalhamentoSalarioBonus.atingimentoPercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% de atingimento) = ${formatarBRL(detalhamentoSalarioBonus.total)}`;
  }
  if (percentualAplicado !== null) {
    return `${formatarBRL(valorBase)} × ${formatarPercentual(percentualAplicado)} = ${formatarBRL(valorComissao)}`;
  }
  return formatarBRL(valorComissao);
}

export default async function ExtratoComissaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ colaboradorId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");

  const { colaboradorId } = await params;
  const search = await searchParams;
  const mesParam = Array.isArray(search.mes) ? search.mes[0] : search.mes;
  const mes = mesParam && /^\d{4}-\d{2}-01$/.test(mesParam) ? mesParam : mesCorrenteUTC();

  const [colaborador, { apuracao, linhas }] = await Promise.all([
    getColaborador(colaboradorId),
    getExtrato(colaboradorId, mes),
  ]);
  if (!colaborador) {
    notFound();
  }

  const totalLinhas = linhas.reduce((soma, l) => soma + l.valorRecebido, 0);

  const detalhamentoSalarioBonus =
    apuracao?.tipoPlano === "salario_bonus_atingimento"
      ? extrairDetalhamentoSalarioBonus(apuracao.inputSnapshot)
      : null;

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb={`Operação › Comissões › ${colaborador.nome}`}
        title={colaborador.nome}
        subtitle={`Extrato de comissão — ${formatarMesAnoUTC(new Date(mes + "T00:00:00Z"))}`}
        actions={
          <Link
            href={`/comissoes?mes=${mes}`}
            className="text-sm font-medium hover:underline"
          >
            Voltar para Comissões
          </Link>
        }
      />

      <div className="flex-1 space-y-6 px-6 py-6">
        {!apuracao && (
          <Card>
            <CardContent className="flex flex-col gap-2 py-6 text-center text-muted-foreground">
              <p>Nenhuma apuração encontrada para este colaborador neste mês.</p>
              <Link
                href={`/comissoes?mes=${mes}`}
                className="text-sm font-medium text-foreground hover:underline"
              >
                Rodar a apuração do mês
              </Link>
            </CardContent>
          </Card>
        )}

        {apuracao && (
          <Card>
            <CardHeader>
              <CardTitle>Resumo da apuração</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Tipo de plano</p>
                <p className="text-sm font-medium">
                  {LABEL_TIPO_PLANO[apuracao.tipoPlano] ?? apuracao.tipoPlano}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Base</p>
                <p className="text-sm font-medium">
                  {apuracao.tipoPlano === "por_calls"
                    ? `${Number(apuracao.valorBase)} calls`
                    : formatarBRL(Number(apuracao.valorBase))}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">% aplicado</p>
                <p className="text-sm font-medium">
                  {apuracao.percentualAplicado !== null
                    ? formatarPercentual(Number(apuracao.percentualAplicado))
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Comissão</p>
                <p className="text-sm font-medium">
                  {formatarBRL(Number(apuracao.valorComissao))}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mês de referência</p>
                <p className="text-sm font-medium">
                  {formatarMesAnoUTC(apuracao.mesReferencia)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mês de pagamento</p>
                <p className="text-sm font-medium">
                  {formatarMesAnoUTC(apuracao.mesPagamento)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant={apuracao.status === "FECHADA" ? "default" : "secondary"}>
                  {apuracao.status === "FECHADA" ? "Fechada" : "Aberta"}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Calculado em</p>
                <p className="text-sm font-medium">
                  {formatarInstanteSP(apuracao.calculadoEm)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {detalhamentoSalarioBonus && (
          <Card>
            <CardHeader>
              <CardTitle>Salário fixo + bônus por atingimento</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Salário fixo</p>
                <p className="text-sm font-medium">
                  {formatarBRL(detalhamentoSalarioBonus.salarioFixo)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Atingimento da meta
                </p>
                <p className="text-sm font-medium">
                  {detalhamentoSalarioBonus.atingimentoPercent.toLocaleString(
                    "pt-BR",
                    { maximumFractionDigits: 2 },
                  )}
                  % (faixa a partir de{" "}
                  {detalhamentoSalarioBonus.faixaEscolhida.minAtingimento}%)
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bônus</p>
                <p className="text-sm font-medium">
                  {formatarBRL(detalhamentoSalarioBonus.bonus)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Total (fixo + bônus)
                </p>
                <p className="text-sm font-semibold">
                  {formatarBRL(detalhamentoSalarioBonus.total)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Linha a linha</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead>Valor recebido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      Nenhuma parcela recebida nesta competência.
                    </TableCell>
                  </TableRow>
                )}
                {linhas.map((linha) => (
                  <TableRow key={linha.parcelaId}>
                    <TableCell>{linha.alunoNome}</TableCell>
                    <TableCell>
                      {LABEL_TIPO_PARCELA[linha.tipo] ?? linha.tipo}
                    </TableCell>
                    <TableCell>{formatarMesAnoUTC(new Date(linha.mesReferencia + "T00:00:00Z"))}</TableCell>
                    <TableCell>
                      {linha.dataPagamento
                        ? formatarDataUTC(linha.dataPagamento)
                        : "-"}
                    </TableCell>
                    <TableCell>{formatarBRL(linha.valorRecebido)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {linhas.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="text-right font-medium">
                      Total (valorBase)
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatarBRL(totalLinhas)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </CardContent>
        </Card>

        {apuracao && (
          <Card>
            <CardContent className="py-4 text-sm text-muted-foreground">
              Fórmula aplicada:{" "}
              <span className="font-medium text-foreground">
                {montarFormula(
                  apuracao.tipoPlano,
                  Number(apuracao.valorBase),
                  apuracao.percentualAplicado !== null
                    ? Number(apuracao.percentualAplicado)
                    : null,
                  Number(apuracao.valorComissao),
                  detalhamentoSalarioBonus,
                )}
              </span>
            </CardContent>
          </Card>
        )}

        {apuracao && (
          <Card>
            <CardHeader>
              <CardTitle>Observação</CardTitle>
            </CardHeader>
            <CardContent>
              <ObservacaoApuracaoForm
                colaboradorId={colaboradorId}
                mesReferencia={mes}
                observacaoAtual={apuracao.observacao}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
