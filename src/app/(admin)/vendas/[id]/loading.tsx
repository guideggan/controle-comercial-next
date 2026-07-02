import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { TopbarSkeleton, TableCardSkeleton } from "@/components/shell/page-skeleton";

// Loading UI do detalhe de venda — dados da venda (grid de campos) +
// tabela de parcelas geradas.
export default function VendaDetalheLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <TopbarSkeleton />
      <div className="flex-1 space-y-6 px-6 py-6">
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </CardContent>
        </Card>
        <TableCardSkeleton rows={5} />
      </div>
    </div>
  );
}
