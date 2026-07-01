import { requireRole } from "@/server/auth/session";
import { AppTopbar } from "@/components/shell/app-topbar";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

// Placeholder de navegação (Fase 1.1) — motor/consulta de comissão chega
// nas Fases 5/6 do roadmap.
export default async function ComissoesPage() {
  await requireRole("ADMIN");

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar breadcrumb="Operação › Comissões" title="Comissões" />
      <div className="flex-1 px-6 py-6">
        <PlaceholderPage titulo="Apuração de comissões" />
      </div>
    </div>
  );
}
