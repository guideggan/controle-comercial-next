"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Papel } from "@prisma/client";
import type { z } from "zod";

import { criarColaboradorSchema } from "@/server/actions/colaboradores.schemas";
import { criarColaborador } from "@/server/actions/colaboradores.actions";
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

type ColaboradorValues = z.infer<typeof criarColaboradorSchema>;

const PAPEIS = Object.values(Papel);

// Client component: Dialog com criar colaborador (AUTH-05) — nome, e-mail,
// papel, contato/PIX e senha inicial. A conta de login é criada no servidor
// (criarColaborador), nunca role/colaboradorId vindos do cliente.
export function ColaboradorForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ColaboradorValues>({
    resolver: zodResolver(criarColaboradorSchema),
    defaultValues: {
      nome: "",
      email: "",
      papel: "SDR",
      telefone: "",
      pix: "",
      senhaInicial: "",
    },
  });

  async function onSubmit(values: ColaboradorValues) {
    setIsSubmitting(true);
    try {
      await criarColaborador(values);
      toast.success("Colaborador criado com sucesso");
      setOpen(false);
      form.reset({
        nome: "",
        email: "",
        papel: "SDR",
        telefone: "",
        pix: "",
        senhaInicial: "",
      });
      router.refresh();
    } catch {
      toast.error("Não foi possível criar o colaborador");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" />}>
        Novo colaborador
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo colaborador</DialogTitle>
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl
                    render={
                      <Input
                        type="email"
                        placeholder="nome@empresa.com"
                        {...field}
                      />
                    }
                  />
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

            <FormField
              control={form.control}
              name="senhaInicial"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha inicial</FormLabel>
                  <FormControl
                    render={
                      <Input
                        type="password"
                        placeholder="Mínimo 8 caracteres"
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
                {isSubmitting ? "Salvando..." : "Criar colaborador"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
