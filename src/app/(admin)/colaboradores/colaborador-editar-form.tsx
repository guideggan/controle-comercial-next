"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Papel } from "@prisma/client";
import type { z } from "zod";

import { editarColaboradorSchema } from "@/server/actions/colaboradores.schemas";
import { editarColaborador } from "@/server/actions/colaboradores.actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EditarColaboradorValues = z.infer<typeof editarColaboradorSchema>;

const PAPEIS = Object.values(Papel);

// Client component: Dialog de edição de nome/papel/contato/PIX de um
// colaborador já existente (COLAB-01). Espelha colaborador-form.tsx (criar),
// mas sem email/senhaInicial (fora de escopo — ver editarColaboradorSchema).
export function ColaboradorEditarForm({
  colaborador,
}: {
  colaborador: {
    id: string;
    nome: string;
    papel: string;
    telefone: string | null;
    pix: string | null;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditarColaboradorValues>({
    resolver: zodResolver(editarColaboradorSchema),
    defaultValues: {
      nome: colaborador.nome,
      papel: colaborador.papel as EditarColaboradorValues["papel"],
      telefone: colaborador.telefone ?? "",
      pix: colaborador.pix ?? "",
    },
  });

  async function onSubmit(values: EditarColaboradorValues) {
    setIsSubmitting(true);
    try {
      await editarColaborador(colaborador.id, values);
      toast.success("Colaborador atualizado com sucesso");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Não foi possível atualizar o colaborador");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          form.reset({
            nome: colaborador.nome,
            papel: colaborador.papel as EditarColaboradorValues["papel"],
            telefone: colaborador.telefone ?? "",
            pix: colaborador.pix ?? "",
          });
        }
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        Editar dados
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {colaborador.nome}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl render={<Input placeholder="Nome completo" {...field} />} />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="papel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Papel</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl
                      render={
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o papel" />
                        </SelectTrigger>
                      }
                    />
                    <SelectContent>
                      {PAPEIS.map((papel) => (
                        <SelectItem key={papel} value={papel}>
                          {papel}
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
              name="telefone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone (opcional)</FormLabel>
                  <FormControl
                    render={<Input placeholder="(11) 90000-0000" {...field} />}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chave PIX (opcional)</FormLabel>
                  <FormControl render={<Input placeholder="Chave PIX" {...field} />} />
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
