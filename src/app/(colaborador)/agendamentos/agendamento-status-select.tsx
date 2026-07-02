"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { atualizarStatusAgendamentoAction } from "@/server/actions/agendamentos.actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OPCOES = [
  { value: "AGENDADO", label: "Agendado" },
  { value: "REALIZADO", label: "Realizado" },
  { value: "NO_SHOW", label: "No-show" },
  { value: "CANCELADO", label: "Cancelado" },
] as const;

// Select inline de status na tabela de agendamentos — mesmo padrão de
// client component fino de vendas-filtros.tsx, mas disparando a Server
// Action diretamente no onValueChange (sem form/dialog, já que é uma única
// mudança de status). authz real (self-or-admin) é reafirmada dentro de
// atualizarStatusAgendamentoAction no server.
export function AgendamentoStatusSelect({
  agendamentoId,
  status,
}: {
  agendamentoId: string;
  status: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onChange(novoStatus: string | null) {
    if (!novoStatus) return;
    setIsSubmitting(true);
    try {
      await atualizarStatusAgendamentoAction(agendamentoId, {
        status: novoStatus as (typeof STATUS_OPCOES)[number]["value"],
      });
      toast.success("Status atualizado.");
      router.refresh();
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o status";
      toast.error(mensagem);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Select value={status} onValueChange={onChange} disabled={isSubmitting}>
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPCOES.map((opcao) => (
          <SelectItem key={opcao.value} value={opcao.value}>
            {opcao.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
