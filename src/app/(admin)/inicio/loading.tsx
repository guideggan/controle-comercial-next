import { DashboardPageSkeleton } from "@/components/shell/page-skeleton";

// Loading UI (Next.js `loading.tsx`) do dashboard consolidado — exibido
// instantaneamente durante a navegação enquanto getDashboardConsolidado
// busca os dados no servidor (múltiplas fontes em paralelo).
export default function InicioLoading() {
  return <DashboardPageSkeleton />;
}
