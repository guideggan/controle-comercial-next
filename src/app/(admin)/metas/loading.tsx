import { TopbarSkeleton, TableCardSkeleton, ChartCardSkeleton } from "@/components/shell/page-skeleton";

export default function MetasLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <TopbarSkeleton />
      <div className="flex-1 space-y-4 px-6 py-6">
        <TableCardSkeleton rows={6} />
        <ChartCardSkeleton height={200} />
      </div>
    </div>
  );
}
