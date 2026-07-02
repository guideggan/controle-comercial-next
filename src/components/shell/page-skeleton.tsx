import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

// Blocos reutilizáveis para os `loading.tsx` de cada rota — instant loading
// state (Next.js loading UI) exibido durante a navegação, enquanto o
// Server Component da página busca os dados. Mantidos simples/neutros (tema
// claro, mesma grade de Card usada nas páginas reais) para a transição não
// "piscar" um layout muito diferente do conteúdo final.

export function TopbarSkeleton() {
  return (
    <header className="flex flex-col gap-4 border-b bg-background px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-9 w-40" />
    </header>
  );
}

export function KpiCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="gap-2 px-6 py-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
        </Card>
      ))}
    </div>
  );
}

export function ChartCardSkeleton({ height = 240 }: { height?: number }) {
  return (
    <Card className="px-6 py-4">
      <Skeleton className="mb-4 h-4 w-40" />
      <Skeleton className="w-full" style={{ height }} />
    </Card>
  );
}

export function TableCardSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card className="overflow-hidden py-0">
      <div className="px-6 py-4">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-3 px-6 pb-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </Card>
  );
}

// Página "dashboard-like" completa (KPIs + gráfico/tabela) — usada por
// /inicio e /painel, as duas telas mais pesadas (múltiplas fontes em
// paralelo).
export function DashboardPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <TopbarSkeleton />
      <div className="flex-1 space-y-4 px-6 py-6">
        <KpiCardsSkeleton />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ChartCardSkeleton />
          </div>
          <TableCardSkeleton rows={4} />
        </div>
        <TableCardSkeleton rows={5} />
      </div>
    </div>
  );
}

// Página só de tabela (listagens: /vendas, /comissoes, /colaboradores,
// /produtos).
export function TablePageSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <TopbarSkeleton />
      <div className="flex-1 space-y-4 px-6 py-6">
        <TableCardSkeleton rows={8} />
      </div>
    </div>
  );
}
