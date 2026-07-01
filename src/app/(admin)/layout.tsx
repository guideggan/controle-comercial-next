import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth/auth";

// Gate server-side do grupo de rotas (admin). Arquivo de propriedade
// EXCLUSIVA do plano 01 — os planos 04/05 adicionam subrotas em (admin)/
// (colaboradores, produtos) mas NÃO reescrevem este layout.
//
// Como os guards do DAL (requireRole) só nascem no plano 02, este layout
// lê a sessão diretamente via auth.api.getSession, sem depender de
// src/server/auth/session.ts.
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
    <div className="flex min-h-full flex-col">
      <header className="border-b px-6 py-4">
        <span className="text-sm font-medium text-muted-foreground">
          Área administrativa
        </span>
      </header>
      <main className="flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
