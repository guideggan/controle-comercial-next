"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { produtoSchema } from "@/server/actions/produtos.schemas";
import {
  alternarProdutoAtivo,
  atualizarProduto,
  criarProduto,
} from "@/server/actions/produtos.actions";
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

type ProdutoValues = z.infer<typeof produtoSchema>;

type ProdutoExistente = {
  id: string;
  nome: string;
  ativo: boolean;
};

type ProdutoFormProps =
  | { mode: "criar"; produto?: undefined }
  | { mode: "editar"; produto: ProdutoExistente };

// Client component: Dialog com criar/editar produto (COLAB-07) + botão de
// ativar/desativar por linha. Produtos nunca são deletados fisicamente
// (referenciados por vendas futuras) — só desativados.
export function ProdutoForm(props: ProdutoFormProps) {
  const { mode, produto } = props;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTogglingAtivo, setIsTogglingAtivo] = useState(false);

  const form = useForm<ProdutoValues>({
    resolver: zodResolver(produtoSchema),
    defaultValues: { nome: produto?.nome ?? "" },
  });

  async function onSubmit(values: ProdutoValues) {
    setIsSubmitting(true);
    try {
      if (mode === "criar") {
        await criarProduto(values);
        toast.success("Produto criado com sucesso");
      } else {
        await atualizarProduto(produto.id, values);
        toast.success("Produto atualizado com sucesso");
      }
      setOpen(false);
      form.reset({ nome: mode === "editar" ? values.nome : "" });
      router.refresh();
    } catch {
      toast.error("Não foi possível salvar o produto");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onToggleAtivo() {
    if (mode !== "editar") return;
    setIsTogglingAtivo(true);
    try {
      await alternarProdutoAtivo(produto.id, !produto.ativo);
      toast.success(produto.ativo ? "Produto desativado" : "Produto ativado");
      router.refresh();
    } catch {
      toast.error("Não foi possível alterar o status do produto");
    } finally {
      setIsTogglingAtivo(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {mode === "editar" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isTogglingAtivo}
          onClick={onToggleAtivo}
        >
          {produto.ativo ? "Desativar" : "Ativar"}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button
              type="button"
              variant={mode === "criar" ? "default" : "outline"}
              size="sm"
            />
          }
        >
          {mode === "criar" ? "Novo produto" : "Editar"}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "criar" ? "Novo produto" : "Editar produto"}
            </DialogTitle>
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
                    <FormControl
                      render={
                        <Input
                          placeholder="Ex.: START, PRO, MASTER, PADRAO, Elite"
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
                  {isSubmitting ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
