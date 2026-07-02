"use client";

import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";

// Seletor de mês do dashboard consolidado — mesmo padrão de
// comissoes-mes-seletor.tsx/metas-mes-seletor.tsx: fonte da verdade é a
// querystring, a page (Server Component) relê via searchParams.
export function InicioMesSeletor({ mes }: { mes: string }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">
        Mês de referência
      </label>
      <Input
        type="month"
        value={mes.slice(0, 7)}
        onChange={(e) => {
          const valor = e.target.value;
          if (!valor) return;
          router.push(`/inicio?mes=${valor}-01`);
        }}
        className="w-40"
      />
    </div>
  );
}
