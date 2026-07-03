"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ColaboradorOpcao = { id: string; nome: string; papel: string };

// Seletor de colaborador para a seção de acompanhamento semanal (META-03) —
// mesmo padrão de ColaboradorSeletor em agendamentos/, escrevendo na
// querystring (?colaboradorId=), sempre relido/revalidado no server.
export function ColaboradorAcompanhamentoSeletor({
  colaboradores,
  selecionadoId,
  mes,
}: {
  colaboradores: ColaboradorOpcao[];
  selecionadoId: string;
  mes: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">
        Acompanhamento de
      </label>
      <Select
        value={selecionadoId}
        onValueChange={(value) => {
          router.push(`/metas?mes=${mes}&colaboradorId=${value}`);
        }}
        items={colaboradores.map((c) => ({
          value: c.id,
          label: `${c.nome} (${c.papel})`,
        }))}
      >
        <SelectTrigger className="w-64">
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
