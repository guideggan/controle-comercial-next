"use client";

import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";

// Seletor de mês do painel do colaborador (PAINEL-03) — mesmo padrão de
// MetasMesSeletor/ComissoesMesSeletor: fonte da verdade é a querystring
// (?mes=), a page (Server Component) relê via searchParams. Nunca aceita
// colaboradorId aqui — o painel é sempre o do usuário da sessão.
export function PainelMesSeletor({ mes }: { mes: string }) {
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
          router.push(`/painel?mes=${valor}-01`);
        }}
        className="w-40"
      />
    </div>
  );
}
