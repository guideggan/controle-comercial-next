"use client";

import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";

// Seletor de mês da tela de Comissões — client component fino que escreve
// na querystring via router.push (fonte da verdade é a URL, a page Server
// Component relê via searchParams), mesmo padrão de vendas-filtros.tsx.
export function ComissoesMesSeletor({ mes }: { mes: string }) {
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
          router.push(`/comissoes?mes=${valor}-01`);
        }}
        className="w-40"
      />
    </div>
  );
}
