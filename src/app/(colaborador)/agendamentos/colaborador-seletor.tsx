"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ColaboradorSdrSsOpcao = { id: string; nome: string; papel: string };

// Seletor de colaborador (SDR/SS) — visível SOMENTE para ADMIN, que pode
// ver/registrar agendamentos de qualquer colaborador (AGEND-01). A fonte da
// verdade é a querystring (?colaboradorId=...), mesmo padrão de
// comissoes-mes-seletor.tsx/vendas-filtros.tsx — a page (Server Component)
// relê via searchParams e reafirma requireSelfOrAdmin no server antes de
// buscar qualquer dado.
export function ColaboradorSeletor({
  colaboradores,
  selecionadoId,
}: {
  colaboradores: ColaboradorSdrSsOpcao[];
  selecionadoId: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">
        Colaborador (SDR/SS)
      </label>
      <Select
        value={selecionadoId}
        onValueChange={(value) => {
          router.push(`/agendamentos?colaboradorId=${value}`);
        }}
        items={colaboradores.map((c) => ({
          value: c.id,
          label: `${c.nome} (${c.papel})`,
        }))}
      >
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {colaboradores.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nome} ({c.papel})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
