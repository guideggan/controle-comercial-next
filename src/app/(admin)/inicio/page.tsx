import { requireRole } from "@/server/auth/session";
import { AppTopbar } from "@/components/shell/app-topbar";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

// Início/Dashboard do admin — placeholder de navegação (Fase 1.1). O
// dashboard real do gestor (indicadores consolidados) é a Fase 9; aqui só
// provamos que a rota existe, está protegida e aparece destacada na
// sidebar quando ativa.
export default async function InicioPage() {
  await requireRole("ADMIN");

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb="Operação › Início"
        title="Início"
        subtitle="Visão consolidada da operação comercial."
      />
      <div className="flex-1 px-6 py-6">
        <PlaceholderPage titulo="Dashboard do gestor" />
      </div>
    </div>
  );
}
