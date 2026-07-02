import { DashboardPageSkeleton } from "@/components/shell/page-skeleton";

// Loading UI do painel self-service do colaborador — mesmo padrão de
// /inicio (KPIs + gráfico + tabela), exibido enquanto meta/apuração/
// extrato/agendamentos são buscados em paralelo no servidor.
export default function PainelLoading() {
  return <DashboardPageSkeleton />;
}
