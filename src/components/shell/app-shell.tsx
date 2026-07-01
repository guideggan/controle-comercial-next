import type { ReactNode } from "react";

import type { Papel } from "@/server/auth/session";
import { AppSidebar } from "@/components/shell/app-sidebar";

// Shell reutilizado pelos grupos de rota (admin) e (colaborador): sidebar
// fixa à esquerda + área de conteúdo rolável à direita. Cada layout de
// grupo só precisa chamar requireUser()/requireRole() e passar role/nome
// — a decisão de QUAIS itens de navegação aparecem vive em nav-config.ts,
// nunca neste componente.
export function AppShell({
  role,
  nome,
  children,
}: {
  role: Papel;
  nome: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1">
      <AppSidebar role={role} nome={nome} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
