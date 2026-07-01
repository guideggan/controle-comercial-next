import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth/auth";
import { AppShell } from "@/components/shell/app-shell";

// Gate server-side do grupo de rotas (admin). Arquivo de propriedade
// EXCLUSIVA do plano 01 — os planos 04/05 adicionam subrotas em (admin)/
// (colaboradores, produtos) mas NÃO reescrevem este layout.
//
// Mantido lendo a sessão diretamente via auth.api.getSession (mesmo
// padrão herdado da Fase 1), em vez de requireRole("ADMIN") — este
// último lança uma exceção genérica em vez de redirecionar, o que
// mudaria o comportamento de UX para um não-admin logado (era redirect
// para /login, viraria página de erro). Fase 1.1 é só presentation;
// mudar esse comportamento fica para quando o DAL ganhar um caminho de
// "forbidden" tratado (fora de escopo aqui).
//
// Fase 1.1: este layout passa a montar o app shell (sidebar + topbar)
// compartilhado com (colaborador); a navegação exibida é derivada do
// papel da sessão em getNavSections (nunca de input do cliente).
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <AppShell role={session.user.role} nome={session.user.name}>
      {children}
    </AppShell>
  );
}
