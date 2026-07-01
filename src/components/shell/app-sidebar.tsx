import type { Papel } from "@/server/auth/session";
import { getNavSections } from "@/components/shell/nav-config";
import { AppSidebarNav } from "@/components/shell/app-sidebar-nav";
import { UserMenu } from "@/components/shell/user-menu";
import { Separator } from "@/components/ui/separator";

// Sidebar fixa da aplicação, compartilhada pelos shells admin e
// colaborador. As seções de navegação são derivadas do papel da sessão
// (nunca de input do cliente) — ver getNavSections em nav-config.ts.
export function AppSidebar({
  role,
  nome,
}: {
  role: Papel;
  nome: string;
}) {
  const sections = getNavSections(role);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold tracking-tight text-primary-foreground">
          NEXT
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            Controle Comercial
          </p>
          <p className="truncate text-xs text-muted-foreground">
            NEXT Ecommerce
          </p>
        </div>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto py-4">
        <AppSidebarNav sections={sections} />
      </div>

      <Separator />

      <div className="p-2">
        <UserMenu nome={nome} papel={role} />
      </div>
    </aside>
  );
}
