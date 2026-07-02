import Link from "next/link";

import { requireUser, requireSelfOrAdmin } from "@/server/auth/session";
import { getAcompanhamentoMeta } from "@/server/services/meta.service";
import { getApuracao, getExtrato } from "@/server/services/apuracao.service";
import { getGridSemanaCorrente } from "@/server/services/agendamento.service";
import { formatarBRL, formatarPercentual } from "@/lib/format";
import { AppTopbar } from "@/components/shell/app-topbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AcompanhamentoSemanal } from "@/app/(admin)/metas/acompanhamento-semanal";

import { PainelMesSeletor } from "./painel-mes-seletor";
import { MetaProgressoChart } from "./meta-progresso-chart";
import { AgendamentosGrid } from "./agendamentos-grid";
import { ExtratoTabela } from "./extrato-tabela";

// Rota /painel — o painel self-service do colaborador (Fase 8,
// PAINEL-01..04), o valor central do produto: cada colaborador vê sozinho a
// PRÓPRIA meta, realizado, comissão e extrato, sem depender do gestor.
//
// AUTORIZAÇÃO (AUTH-03/Pitfall 1/IDOR) — regra de ouro desta página: o
// colaboradorId usado em TODA leitura vem exclusivamente de
// `user.colaboradorId` (session, via requireUser/requireSelfOrAdmin) e o
// único parâmetro aceito da URL é `?mes=` (a competência) — nunca um
// colaboradorId. requireSelfOrAdmin(user.colaboradorId) reafirma essa regra
// mesmo passando o próprio id da sessão, mantendo o mesmo padrão defensivo
// usado em /agendamentos. Não existe forma de um colaborador ver o painel
// de outro trocando um parâmetro na URL — não há parâmetro que aceite id.

const PAPEL_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
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

function mesCorrenteUTC(): string {
  const agora = new Date();
  const ano = agora.getUTCFullYear();
  const mes = String(agora.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}-01`;
}

// Mesma convenção de rótulo de acompanhamento-semanal.tsx (v1.1): a meta de
// SDR/SS é sempre em REUNIÕES REALIZADAS, nunca "agendamentos".
function formatarValor(valor: number, unidade: "VALOR" | "AGENDAMENTOS" | null) {
  if (unidade === "AGENDAMENTOS") return `${valor} reuniões realizadas`;
  return formatarBRL(valor);
}

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const mesParam = Array.isArray(params.mes) ? params.mes[0] : params.mes;
  const mes = mesParam && /^\d{4}-\d{2}-01$/.test(mesParam) ? mesParam : mesCorrenteUTC();

  // ADMIN não tem colaboradorId de operação vinculado (papel de gestão) —
  // mantém simples: aponta para o dashboard consolidado do gestor (Fase 9),
  // sem tentar montar um painel self-service vazio para ele aqui.
  if (user.role === "ADMIN" && !user.colaboradorId) {
    return (
      <div className="flex flex-1 flex-col">
        <AppTopbar
          breadcrumb="Operação › Meu Painel"
          title={`Olá, ${user.name}`}
          subtitle="Como Admin/Gestor, use o Dashboard consolidado."
          actions={<Badge variant="outline">{PAPEL_LABEL[user.role] ?? user.role}</Badge>}
        />
        <div className="flex-1 px-6 py-6">
          <Card className="px-6 py-4 text-sm text-muted-foreground">
            O painel individual é para Closers/SDR/SS. Acompanhe o time em{" "}
            <Link href="/inicio" className="font-medium text-foreground hover:underline">
              Início
            </Link>
            .
          </Card>
        </div>
      </div>
    );
  }

  if (!user.colaboradorId) {
    return (
      <div className="flex flex-1 flex-col">
        <AppTopbar
          breadcrumb="Operação › Meu Painel"
          title={`Olá, ${user.name}`}
          actions={<Badge variant="outline">{PAPEL_LABEL[user.role] ?? user.role}</Badge>}
        />
        <div className="flex-1 px-6 py-6">
          <Card className="px-6 py-4 text-sm text-muted-foreground">
            Sua conta ainda não está vinculada a um colaborador. Fale com o
            administrador.
          </Card>
        </div>
      </div>
    );
  }

  // Reafirma a autorização no server (mesmo padrão de /agendamentos): o
  // alvo é SEMPRE o colaboradorId da própria sessão.
  await requireSelfOrAdmin(user.colaboradorId);
  const colaboradorId = user.colaboradorId;
  const isSdrOuSs = user.role === "SDR" || user.role === "SS";

  const [acompanhamento, apuracao, extrato, grid] = await Promise.all([
    getAcompanhamentoMeta(colaboradorId, mes),
    getApuracao(colaboradorId, mes),
    getExtrato(colaboradorId, mes),
    isSdrOuSs ? getGridSemanaCorrente(colaboradorId) : Promise.resolve(null),
  ]);

  const { unidade, metaMensal, realizadoMes, semanas } = acompanhamento;
  const semanaAtual = semanas[semanas.length - 1] ?? null;
  const saldoAtual = semanaAtual ? semanaAtual.saldo : metaMensal - realizadoMes;
  const percentualAtingido = metaMensal > 0 ? realizadoMes / metaMensal : 0;

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb="Operação › Meu Painel"
        title={`Olá, ${user.name}`}
        subtitle="Acompanhe sua meta, comissão e extrato do mês."
        actions={
          <div className="flex items-center gap-3">
            <PainelMesSeletor mes={mes} />
            <Badge variant="outline">{PAPEL_LABEL[user.role] ?? user.role}</Badge>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-6 py-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Meta do mês</CardDescription>
              <CardTitle className="text-2xl">
                {metaMensal > 0 ? formatarValor(metaMensal, unidade) : "Sem meta"}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Realizado no mês</CardDescription>
              <CardTitle className="text-2xl">
                {formatarValor(realizadoMes, unidade ?? "VALOR")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={realizadoMes >= metaMensal && metaMensal > 0 ? "default" : "secondary"}>
                {formatarPercentual(percentualAtingido)} da meta
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Saldo até a meta</CardDescription>
              <CardTitle className="text-2xl">
                {saldoAtual > 0 ? "" : "+"}
                {formatarValor(Math.abs(saldoAtual), unidade ?? "VALOR")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {saldoAtual > 0
                  ? "Falta para bater a meta proporcional"
                  : "Meta proporcional superada"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>
                Comissão {apuracao ? "apurada" : "prevista"} do mês
              </CardDescription>
              <CardTitle className="text-2xl">
                {apuracao ? formatarBRL(Number(apuracao.valorComissao)) : "Ainda não apurada"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {apuracao
                  ? `${LABEL_TIPO_PLANO[apuracao.tipoPlano] ?? apuracao.tipoPlano} · ${apuracao.status === "FECHADA" ? "mês fechado" : "mês aberto"}`
                  : "O admin ainda não rodou a apuração deste mês."}
              </p>
            </CardContent>
          </Card>
        </div>

        {semanas.length > 0 ? (
          <Card>
            <CardHeader>
              <CardDescription>Progresso semanal</CardDescription>
              <CardTitle>% esperado vs % atingido</CardTitle>
            </CardHeader>
            <CardContent>
              <MetaProgressoChart semanas={semanas} />
            </CardContent>
          </Card>
        ) : (
          <Card className="px-6 py-4 text-sm text-muted-foreground">
            Nenhuma meta definida para você neste mês ainda — fale com o
            administrador.
          </Card>
        )}

        {semanas.length > 0 && <AcompanhamentoSemanal acompanhamento={acompanhamento} />}

        {isSdrOuSs && grid && <AgendamentosGrid grid={grid} />}

        <ExtratoTabela linhas={extrato.linhas} />
      </div>
    </div>
  );
}
