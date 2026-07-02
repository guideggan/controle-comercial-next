"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  definirMetaSchema,
  type DefinirMetaInput,
} from "@/server/actions/metas.schemas";
import { definirMetaAction } from "@/server/actions/metas.actions";
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

// Formulário de definição de meta mensal (META-01). A UNIDADE nunca é
// escolhida aqui — o form sempre manda os dois campos possíveis
// (valorMeta/metaAgendamentos) como string, e o service decide qual usar
// pelo papel real do colaborador (nunca confia em unidade vinda do client,
// mesmo padrão de Pitfall 1/IDOR aplicado a dados, não só a autorização).

type FormValues = {
  mesReferencia: string; // "YYYY-MM" do input type="month"
  valor: string; // valor bruto digitado — vira valorMeta OU metaAgendamentos conforme `unidade`
};

function mesAtualISO(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

export function MetaForm({
  colaboradorId,
  colaboradorNome,
  unidade,
  metaAtual,
  mesReferenciaAtual,
}: {
  colaboradorId: string;
  colaboradorNome: string;
  unidade: "VALOR" | "AGENDAMENTOS";
  metaAtual: number | null;
  mesReferenciaAtual: string; // "YYYY-MM-01"
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    defaultValues: {
      mesReferencia: mesReferenciaAtual.slice(0, 7) || mesAtualISO(),
      valor: metaAtual !== null ? String(metaAtual) : "",
    },
  });

  async function onSubmit(values: FormValues) {
    const numero = Number(values.valor);
    if (Number.isNaN(numero)) {
      toast.error("Informe um valor numérico válido");
      return;
    }

    const payload: DefinirMetaInput = {
      mesReferencia: `${values.mesReferencia}-01`,
      valorMeta: unidade === "VALOR" ? numero : undefined,
      metaAgendamentos: unidade === "AGENDAMENTOS" ? numero : undefined,
    };

    const parsed = definirMetaSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    setIsSubmitting(true);
    try {
      await definirMetaAction(colaboradorId, parsed.data);
      toast.success(`Meta de ${colaboradorNome} salva com sucesso`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Não foi possível salvar a meta";
      toast.error(mensagem);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        {metaAtual !== null ? "Editar meta" : "Definir meta"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Meta mensal de {colaboradorNome}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="mesReferencia"
              rules={{ required: "Informe o mês de referência" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mês de referência</FormLabel>
                  <FormControl render={<Input type="month" {...field} />} />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="valor"
              rules={{ required: "Informe a meta" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {unidade === "VALOR"
                      ? "Meta mensal (R$)"
                      : "Meta mensal (nº de reuniões realizadas)"}
                  </FormLabel>
                  <FormControl
                    render={
                      <Input
                        type="number"
                        step={unidade === "VALOR" ? "0.01" : "1"}
                        min="0"
                        placeholder={unidade === "VALOR" ? "Ex.: 15000" : "Ex.: 110"}
                        {...field}
                      />
                    }
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar meta"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
