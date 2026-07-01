"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { redefinirSenhaSchema } from "@/server/actions/colaboradores.schemas";
import {
  desativarColaborador,
  redefinirSenha,
} from "@/server/actions/colaboradores.actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

type RedefinirSenhaValues = z.infer<typeof redefinirSenhaSchema>;

type ColaboradorLinha = {
  id: string;
  nome: string;
  ativo: boolean;
  temContaVinculada: boolean;
};

// Client component: ações por linha da lista de colaboradores (AUTH-05) —
// desativar conta (com confirmação) e redefinir senha. Texto em pt-BR.
export function ColaboradorActions({
  colaborador,
}: {
  colaborador: ColaboradorLinha;
}) {
  const router = useRouter();
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const form = useForm<RedefinirSenhaValues>({
    resolver: zodResolver(redefinirSenhaSchema),
    defaultValues: { novaSenha: "" },
  });

  async function onDesativar() {
    setIsDeactivating(true);
    try {
      await desativarColaborador(colaborador.id);
      toast.success("Colaborador desativado");
      router.refresh();
    } catch {
      toast.error("Não foi possível desativar o colaborador");
    } finally {
      setIsDeactivating(false);
    }
  }

  async function onRedefinirSenha(values: RedefinirSenhaValues) {
    setIsResetting(true);
    try {
      await redefinirSenha(colaborador.id, values.novaSenha);
      toast.success("Senha redefinida com sucesso");
      setResetOpen(false);
      form.reset({ novaSenha: "" });
      router.refresh();
    } catch {
      toast.error("Não foi possível redefinir a senha");
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!colaborador.temContaVinculada}
            />
          }
        >
          Redefinir senha
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha de {colaborador.nome}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onRedefinirSenha)}
              className="flex flex-col gap-4"
            >
              <FormField
                control={form.control}
                name="novaSenha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova senha</FormLabel>
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
                <Button type="submit" disabled={isResetting}>
                  {isResetting ? "Salvando..." : "Redefinir senha"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={!colaborador.ativo || isDeactivating}
            />
          }
        >
          Desativar
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              {colaborador.nome} perderá acesso imediatamente (a sessão
              logada será encerrada). Esta ação pode ser revertida
              redefinindo a senha e reativando a conta depois, se
              necessário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDesativar} disabled={isDeactivating}>
              {isDeactivating ? "Desativando..." : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
