"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { redefinirSenhaSchema } from "@/server/actions/colaboradores.schemas";
import {
  redefinirSenha,
  arquivarColaborador,
  excluirColaborador,
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
  const [resetOpen, setResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<RedefinirSenhaValues>({
    resolver: zodResolver(redefinirSenhaSchema),
    defaultValues: { novaSenha: "" },
  });

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

  // Arquivar (v1.1): mesmo mecanismo de desativar (ativo=false + revoga
  // sessões), mas com AuditLog e semântica de "removido da lista ativa sem
  // perder histórico" — caminho primário de "remover" alguém no v1.1.
  async function onArquivar() {
    setIsArchiving(true);
    try {
      await arquivarColaborador(colaborador.id);
      toast.success("Colaborador arquivado");
      router.refresh();
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível arquivar o colaborador";
      toast.error(mensagem);
    } finally {
      setIsArchiving(false);
    }
  }

  // Excluir (v1.1): hard-delete só quando não há NENHUM histórico vinculado
  // — a action já lança um erro amigável instruindo a arquivar em vez de
  // excluir; o toast de erro repassa essa mensagem tal qual.
  async function onExcluir() {
    setIsDeleting(true);
    try {
      await excluirColaborador(colaborador.id);
      toast.success("Colaborador excluído");
      router.refresh();
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o colaborador";
      toast.error(mensagem);
    } finally {
      setIsDeleting(false);
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

      {/* v1.1: "Arquivar" é o caminho primário de "remover" alguém da lista
          ativa (ativo=false + revoga sessões + AuditLog) — substitui o
          antigo botão "Desativar" nesta lista (mesmo mecanismo de dados,
          nome/registro mais alinhado ao fluxo de gestão de equipe atual). */}
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!colaborador.ativo || isArchiving}
            />
          }
        >
          Arquivar
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              {colaborador.nome} perderá acesso imediatamente (a sessão
              logada será encerrada) e sairá das listas/seletores ativos.
              O histórico vinculado (vendas, comissões, metas) é
              preservado — nada é apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onArquivar} disabled={isArchiving}>
              {isArchiving ? "Arquivando..." : "Arquivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
            />
          }
        >
          Excluir
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              Exclusão definitiva de {colaborador.nome} — só é permitida
              quando não há NENHUM histórico vinculado (vendas, planos,
              apurações, metas, agendamentos). Se houver histórico, use
              &quot;Arquivar&quot; em vez de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onExcluir} disabled={isDeleting}>
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
