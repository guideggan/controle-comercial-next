import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { TopbarSkeleton, TableCardSkeleton } from "@/components/shell/page-skeleton";

// Loading UI do extrato de comissão por colaborador — resumo (cards) +
// tabela linha a linha.
export default function ExtratoComissaoLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <TopbarSkeleton />
      <div className="flex-1 space-y-6 px-6 py-6">
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
        <TableCardSkeleton rows={6} />
      </div>
    </div>
  );
}
