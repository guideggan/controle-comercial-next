import { requireRole } from "@/server/auth/session";
import { AppTopbar } from "@/components/shell/app-topbar";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

// Placeholder de navegação (Fase 1.1) — cadastro de metas chega em fase
// própria do roadmap.
export default async function MetasPage() {
  await requireRole("ADMIN");

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar breadcrumb="Administração › Metas" title="Metas" />
      <div className="flex-1 px-6 py-6">
        <PlaceholderPage titulo="Cadastro de metas" />
      </div>
    </div>
  );
}
