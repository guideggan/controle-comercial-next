"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import {
  criarAgendamentoSchema,
  type CriarAgendamentoInput,
} from "@/server/actions/agendamentos.schemas";
import { criarAgendamentoAction } from "@/server/actions/agendamentos.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_OPCOES = [
  { value: "AGENDADO", label: "Agendado" },
  { value: "REALIZADO", label: "Realizado" },
  { value: "NO_SHOW", label: "No-show" },
  { value: "CANCELADO", label: "Cancelado" },
] as const;

// "Hoje" no fuso do usuário (não UTC) para o valor inicial do input
// type="date" — o próprio SDR/SS confirma/edita antes de salvar, mesmo
// padrão de hojeLocalISO() em parcela-pagamento-form.tsx (Pitfall 6: só
// aceitável na borda de input do usuário, nunca na exibição de dado
// persistido).
function hojeLocalISO(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// Formulário de registro de agendamento (AGEND-01). `colaboradorId` é
// SEMPRE resolvido no server antes de chegar aqui (própria sessão, ou
// escolhido pelo ADMIN dentre colaboradores SDR/SS reais) — nunca um input
// livre de texto, para não abrir brecha de IDOR mesmo que a action
// reafirme requireSelfOrAdmin no server.
// criarAgendamentoSchema tem `status` com `.default()` — no Zod v4 isso
// torna o tipo de ENTRADA do schema (z.input) diferente do tipo de SAÍDA
// (z.infer/CriarAgendamentoInput, usado após .parse()). Mesmo cuidado de
// venda-form.tsx (VendaFormValues): o formulário usa sempre o tipo de
// ENTRADA para não quebrar Resolver<input> vs Control<output> (TS2322).
type AgendamentoFormValues = z.input<typeof criarAgendamentoSchema>;

export function AgendamentoForm({ colaboradorId }: { colaboradorId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AgendamentoFormValues>({
    resolver: zodResolver(criarAgendamentoSchema),
    defaultValues: {
      data: hojeLocalISO(),
      status: "AGENDADO",
      observacao: "",
    },
  });

  async function onSubmit(values: AgendamentoFormValues) {
    setIsSubmitting(true);
    try {
      const parsed: CriarAgendamentoInput = criarAgendamentoSchema.parse(values);
      await criarAgendamentoAction(colaboradorId, parsed);
      toast.success("Agendamento registrado.");
      form.reset({ data: hojeLocalISO(), status: "AGENDADO", observacao: "" });
      router.refresh();
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível registrar o agendamento";
      toast.error(mensagem);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar agendamento</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-wrap items-end gap-3"
          >
            <FormField
              control={form.control}
              name="data"
              render={({ field }) => (
                <FormItem className="w-40">
                  <FormLabel>Data</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="w-40">
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUS_OPCOES.map((opcao) => (
                        <SelectItem key={opcao.value} value={opcao.value}>
                          {opcao.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacao"
              render={({ field }) => (
                <FormItem className="min-w-56 flex-1">
                  <FormLabel>Observação</FormLabel>
                  <FormControl>
                    <Input placeholder="Opcional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Registrar"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
