import type { Papel } from "@/server/auth/session";
import { getNavSections } from "@/components/shell/nav-config";
import { AppSidebarNav } from "@/components/shell/app-sidebar-nav";
import { UserMenu } from "@/components/shell/user-menu";
import { Separator } from "@/components/ui/separator";
import { listarVendasPendentesAprovacao } from "@/server/services/venda.service";

// Sidebar fixa da aplicação, compartilhada pelos shells admin e
// colaborador. As seções de navegação são derivadas do papel da sessão
// (nunca de input do cliente) — ver getNavSections em nav-config.ts.
//
// v1.1 (VENDA-11): ADMIN vê a contagem de vendas pendentes de aprovação
// como badge no item "Vendas" — busca aqui (Server Component, já dentro do
// shell autenticado) em vez de em cada page, para o número aparecer em
// qualquer rota do admin, não só em /vendas.
export async function AppSidebar({
  role,
  nome,
}: {
  role: Papel;
  nome: string;
}) {
  const sections = getNavSections(role);
  const vendasPendentes =
    role === "ADMIN" ? (await listarVendasPendentesAprovacao()).length : 0;

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
        <AppSidebarNav
          sections={sections}
          counts={{ vendasPendentes }}
        />
      </div>

      <Separator />

      <div className="p-2">
        <UserMenu nome={nome} papel={role} />
      </div>
    </aside>
  );
}
