import { notFound } from "next/navigation";

import { requireRole } from "@/server/auth/session";
import { getColaborador } from "@/server/repositories/colaborador.repo";
import {
  getPlanoVigente,
  listarPlanosDoColaborador,
} from "@/server/services/plano-comissao.service";
import { formatarBRL, formatarPercentual } from "@/lib/format";
import { AppTopbar } from "@/components/shell/app-topbar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ColaboradorEditarForm } from "@/app/(admin)/colaboradores/colaborador-editar-form";
import { PlanoForm } from "@/app/(admin)/colaboradores/[id]/plano-form";
import { PlanoHistorico } from "@/app/(admin)/colaboradores/[id]/plano-historico";

// Resumo pt-BR da config do plano vigente, mesma convenção de exibição do
// plano-historico.tsx (dinheiro/percentual só formatados aqui, nunca na
// escrita/validação).
function resumoConfigVigente(
  tipo: string,
  config: Record<string, unknown>,
): string {
  switch (tipo) {
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

const LABEL_TIPO: Record<string, string> = {
  percentual_fixo: "% fixo",
  progressivo_atingimento: "Progressivo por atingimento",
  fixo_variavel: "Fixo + variável",
  por_calls: "Por calls",
};

// Tela admin de detalhe do colaborador (COLAB-01..06): dados/contato/PIX,
// plano de comissão vigente (nos 4 formatos) e histórico de vigências.
// Gated por requireRole("ADMIN") — mesma fronteira real de autorização de
// colaboradores/page.tsx (nunca confiar só no layout (admin)).
export default async function ColaboradorDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");

  const { id } = await params;

  const colaborador = await getColaborador(id);
  if (!colaborador) {
    notFound();
  }

  const [planoVigente, historico] = await Promise.all([
    getPlanoVigente(id),
    listarPlanosDoColaborador(id),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb={`Administração › Colaboradores › ${colaborador.nome}`}
        title={colaborador.nome}
        subtitle={`${colaborador.papel} · ${colaborador.ativo ? "Ativo" : "Inativo"}`}
        actions={
          <ColaboradorEditarForm
            colaborador={{
              id: colaborador.id,
              nome: colaborador.nome,
              papel: colaborador.papel,
              telefone: colaborador.telefone,
              pix: colaborador.pix,
            }}
          />
        }
      />

      <div className="flex-1 space-y-6 px-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados do colaborador</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Nome</p>
              <p className="text-sm font-medium">{colaborador.nome}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">E-mail</p>
              <p className="text-sm font-medium">{colaborador.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Papel</p>
              <Badge variant="outline">{colaborador.papel}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={colaborador.ativo ? "default" : "secondary"}>
                {colaborador.ativo ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Telefone</p>
              <p className="text-sm font-medium">
                {colaborador.telefone || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Chave PIX</p>
              <p className="text-sm font-medium">{colaborador.pix || "-"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Plano de comissão vigente</CardTitle>
            <PlanoForm
              colaboradorId={colaborador.id}
              temPlanoVigente={Boolean(planoVigente)}
            />
          </CardHeader>
          <CardContent>
            {planoVigente ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  {LABEL_TIPO[planoVigente.tipo]}
                </p>
                <p className="text-sm text-muted-foreground">
                  {resumoConfigVigente(
                    planoVigente.tipo,
                    planoVigente.config as Record<string, unknown>,
                  )}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum plano configurado. Use o botão acima para definir o
                primeiro plano.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de vigências</CardTitle>
          </CardHeader>
          <CardContent>
            <PlanoHistorico planos={historico} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
