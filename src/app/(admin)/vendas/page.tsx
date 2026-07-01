import { requireRole } from "@/server/auth/session";
import { AppTopbar } from "@/components/shell/app-topbar";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

// Placeholder de navegação (Fase 1.1) — CRUD de venda chega em fase
// própria do roadmap.
export default async function VendasPage() {
  await requireRole("ADMIN");

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar breadcrumb="Operação › Vendas" title="Vendas" />
      <div className="flex-1 px-6 py-6">
        <PlaceholderPage titulo="Registro de vendas" />
      </div>
    </div>
  );
}
