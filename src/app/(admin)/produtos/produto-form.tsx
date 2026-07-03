"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CategoriaProduto } from "@prisma/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProdutoValues = z.infer<typeof produtoSchema>;

// Rótulos legíveis das categorias do catálogo v1.1 — a UI completa de
// gestão de produtos por categoria fica para o agente de UI de follow-up;
// aqui só o mínimo para o formulário existente continuar funcionando com o
// campo agora obrigatório.
const CATEGORIA_LABEL: Record<CategoriaProduto, string> = {
  ACELERACAO_MENTORIA: "Aceleração / Mentoria",
  IMERSAO_PRESENCIAL: "Imersão presencial",
  EVENTO_PRESENCIAL: "Evento presencial",
};
const CATEGORIAS = Object.values(CategoriaProduto);

type ProdutoExistente = {
  id: string;
  nome: string;
  ativo: boolean;
  categoria?: CategoriaProduto | null;
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
    defaultValues: {
      nome: produto?.nome ?? "",
      categoria: produto?.categoria ?? undefined,
    },
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
      form.reset({
        nome: mode === "editar" ? values.nome : "",
        categoria: mode === "editar" ? values.categoria : undefined,
      });
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
                          placeholder="Ex.: Mentoria Elite, Next Track, Next Experience"
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
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      items={CATEGORIAS.map((categoria) => ({
                        value: categoria,
                        label: CATEGORIA_LABEL[categoria],
                      }))}
                    >
                      <FormControl
                        render={
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione a categoria" />
                          </SelectTrigger>
                        }
                      />
                      <SelectContent>
                        {CATEGORIAS.map((categoria) => (
                          <SelectItem key={categoria} value={categoria}>
                            {CATEGORIA_LABEL[categoria]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
