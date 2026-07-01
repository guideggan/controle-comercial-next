import { requireUser } from "@/server/auth/session";
import { AppTopbar } from "@/components/shell/app-topbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { MetaChart } from "./meta-chart";

const PAPEL_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  CLOSER: "Closer",
  SDR: "SDR",
  SS: "SS",
};

// Rota /painel — PROVA que a rota é protegida e self-scoped via guard
// server-side (requireUser), não apenas pelo middleware (ver
// src/middleware.ts e o comentário sobre CVE-2025-29927).
//
// Fase 8 (Dashboard do Colaborador) substitui os cards placeholder abaixo
// por dados reais lidos sempre através de requireSelfOrAdmin(colaboradorId),
// nunca confiando em um colaboradorId vindo do cliente. O gráfico usa
// dados de EXEMPLO só para validar o padrão de visualização (Recharts).
export default async function PainelPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb="Operação › Meu Painel"
        title={`Olá, ${user.name}`}
        subtitle="Acompanhe sua meta e comissão do mês."
        actions={<Badge variant="outline">{PAPEL_LABEL[user.role] ?? user.role}</Badge>}
      />

      <div className="flex flex-1 flex-col gap-6 px-6 py-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardDescription>Meta do mês</CardDescription>
              <CardTitle className="text-2xl">Em breve</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                O acompanhamento de meta é calculado a partir das Fases 6/8
                do projeto.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Comissão prevista</CardDescription>
              <CardTitle className="text-2xl">Em breve</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                O motor de comissão é calculado a partir da Fase 5 do
                projeto.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardDescription>Exemplo de gráfico</CardDescription>
            <CardTitle>Atingimento de meta (dado de exemplo)</CardTitle>
          </CardHeader>
          <CardContent>
            <MetaChart />
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Colaborador ID: {user.colaboradorId ?? "(nenhum vinculado)"}
        </p>
      </div>
    </div>
  );
}
