"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  marcarParcelaPagaSchema,
  type MarcarParcelaPagaInput,
} from "@/server/actions/recebimentos.schemas";
import {
  marcarParcelaPagaAction,
  reverterParcelaPendenteAction,
} from "@/server/actions/recebimentos.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

// Client component de pagamento de parcela (PGTO-01): mesmo padrão de
// venda-form.tsx — react-hook-form + zodResolver(marcarParcelaPagaSchema) +
// toast do sonner + router.refresh() após sucesso. Duas ações por parcela:
// "Marcar como pago" (abre Dialog) quando PENDENTE, "Reverter para
// pendente" (chamada direta, sem dialog) quando PAGO.

// "Hoje" no fuso do admin (não UTC) para o valor inicial do input
// type="date" — o admin confirma/edita antes de salvar, então usar
// getters locais aqui é aceitável (diferente da exibição em tabela, que
// usa sempre getters UTC do valor já persistido — Pitfall 6).
function hojeLocalISO(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export type ParcelaPagamentoFormProps = {
  parcelaId: string;
  valorPrevisto: number;
  status: "PENDENTE" | "PAGO";
  bloqueado: boolean;
};

export function ParcelaPagamentoForm({
  parcelaId,
  valorPrevisto,
  status,
  bloqueado,
}: ParcelaPagamentoFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MarcarParcelaPagaInput>({
    resolver: zodResolver(marcarParcelaPagaSchema),
    defaultValues: {
      valorRecebido: valorPrevisto,
      dataPagamento: hojeLocalISO(),
    },
  });

  async function onSubmit(values: MarcarParcelaPagaInput) {
    setIsSubmitting(true);
    try {
      await marcarParcelaPagaAction(parcelaId, values);
      toast.success("Parcela marcada como paga");
      setOpen(false);
      router.refresh();
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível marcar a parcela como paga";
      toast.error(mensagem);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onReverter() {
    setIsSubmitting(true);
    try {
      await reverterParcelaPendenteAction(parcelaId);
      toast.success("Parcela revertida para pendente");
      router.refresh();
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível reverter a parcela";
      toast.error(mensagem);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "PAGO") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={bloqueado || isSubmitting}
        onClick={onReverter}
      >
        {isSubmitting ? "Revertendo..." : "Reverter para pendente"}
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset({
            valorRecebido: valorPrevisto,
            dataPagamento: hojeLocalISO(),
          });
        }
        setOpen(next);
      }}
    >
      <DialogTrigger
        disabled={bloqueado}
        render={<Button type="button" size="sm" />}
      >
        Marcar como pago
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar parcela como paga</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="valorRecebido"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor recebido (R$)</FormLabel>
                  <FormControl
                    render={
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number(e.target.value))
                        }
                      />
                    }
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dataPagamento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de pagamento</FormLabel>
                  <FormControl render={<Input type="date" {...field} />} />
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
