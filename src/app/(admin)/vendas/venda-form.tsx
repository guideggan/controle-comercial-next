"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import {
  vendaSchema,
  type VendaInput,
} from "@/server/actions/vendas.schemas";
import {
  criarVendaAction,
  atualizarVendaAction,
} from "@/server/actions/vendas.actions";
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

// Formulário único de venda (VENDA-01): mesmo padrão de produto-form.tsx /
// plano-form.tsx — react-hook-form + zodResolver(vendaSchema) + toast +
// router.refresh. Dialog para "Nova venda" na lista (mesma escolha visual de
// ProdutoForm/PlanoForm) e também reaproveitado na página de detalhe para
// "Editar" (mode="editar").
//
// Produtos/colaboradores chegam como props (Server Component pai já buscou
// via requireRole) — nenhum fetch de dados sensíveis acontece no client.

const PLATAFORMAS = [
  { value: "ASAAS", label: "ASAAS" },
  { value: "PAGARME", label: "Pagar.me" },
  { value: "INTER", label: "Inter" },
  { value: "GURU", label: "Guru" },
  { value: "OUTRO", label: "Outro" },
] as const;

const TIPOS_PAGAMENTO = [
  { value: "A_VISTA", label: "À vista" },
  { value: "MENSALISTA", label: "Mensalista" },
] as const;

// `vendaSchema` tem campos com `.default()` (entrada/valorMensalidade/
// numeroParcelas) — no Zod v4 isso torna o tipo de ENTRADA do schema
// (z.input) diferente do tipo de SAÍDA (z.infer/VendaInput, usado após
// .parse()). O `zodResolver` é tipado sobre o input; usar `VendaInput`
// (saída) como generic do useForm causa incompatibilidade de tipos entre
// Resolver<input> e Control<output> (TS2322). O formulário usa sempre o
// tipo de ENTRADA; a Server Action recebe o resultado já validado
// (VendaInput, saída) devolvido implicitamente pelo resolver via RHF.
type VendaFormValues = z.input<typeof vendaSchema>;

export type ProdutoOpcao = { id: string; nome: string };
export type ColaboradorOpcao = { id: string; nome: string };

export type VendaExistente = {
  id: string;
  dataVenda: string; // "YYYY-MM-DD"
  alunoNome: string;
  pagadorNome: string;
  plataforma: VendaInput["plataforma"];
  produtoId: string;
  tipoPagamento: VendaInput["tipoPagamento"];
  valorTotal: number;
  entrada: number;
  valorMensalidade: number;
  numeroParcelas: number;
  diaVencimento: number;
  mesReferencia: string; // "YYYY-MM-01"
  closerId: string;
  sdrId?: string | null;
  observacao?: string | null;
};

type VendaFormProps = (
  | { mode: "criar"; venda?: undefined; bloqueado?: undefined }
  | { mode: "editar"; venda: VendaExistente; bloqueado?: boolean }
) & {
  produtos: ProdutoOpcao[];
  closers: ColaboradorOpcao[];
  sdrs: ColaboradorOpcao[];
};

// Converte "YYYY-MM-01" (persistido) <-> "YYYY-MM" (input type="month") sem
// nunca passar por `new Date(string)` (Pitfall 6) — apenas slice de string.
function paraInputMonth(mesReferencia: string): string {
  return mesReferencia.slice(0, 7);
}

function paraMesReferencia(mesAno: string): string {
  return `${mesAno}-01`;
}

function valoresPadrao(venda?: VendaExistente): VendaFormValues {
  if (venda) {
    return {
      dataVenda: venda.dataVenda,
      alunoNome: venda.alunoNome,
      pagadorNome: venda.pagadorNome,
      plataforma: venda.plataforma,
      produtoId: venda.produtoId,
      tipoPagamento: venda.tipoPagamento,
      valorTotal: venda.valorTotal,
      entrada: venda.entrada,
      valorMensalidade: venda.valorMensalidade,
      numeroParcelas: venda.numeroParcelas,
      diaVencimento: venda.diaVencimento,
      mesReferencia: venda.mesReferencia,
      closerId: venda.closerId,
      sdrId: venda.sdrId ?? undefined,
      observacao: venda.observacao ?? undefined,
    };
  }

  const hoje = new Date();
  const dataHoje = hoje.toISOString().slice(0, 10);
  const mesAtual = hoje.toISOString().slice(0, 7);

  return {
    dataVenda: dataHoje,
    alunoNome: "",
    pagadorNome: "",
    plataforma: "ASAAS",
    produtoId: "",
    tipoPagamento: "MENSALISTA",
    valorTotal: 0,
    entrada: 0,
    valorMensalidade: 0,
    numeroParcelas: 1,
    diaVencimento: 5,
    mesReferencia: paraMesReferencia(mesAtual),
    closerId: "",
    sdrId: undefined,
    observacao: undefined,
  };
}

export function VendaForm(props: VendaFormProps) {
  const { mode, produtos, closers, sdrs } = props;
  const venda = mode === "editar" ? props.venda : undefined;
  const bloqueado = mode === "editar" ? Boolean(props.bloqueado) : false;

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<VendaFormValues, unknown, VendaInput>({
    resolver: zodResolver(vendaSchema),
    defaultValues: valoresPadrao(venda),
  });

  const tipoPagamento = form.watch("tipoPagamento");
  const isMensalista = tipoPagamento === "MENSALISTA";

  async function onSubmit(values: VendaInput) {
    setIsSubmitting(true);
    try {
      if (mode === "criar") {
        await criarVendaAction(values);
        toast.success("Venda cadastrada com sucesso");
        form.reset(valoresPadrao());
      } else {
        await atualizarVendaAction(venda!.id, values);
        toast.success("Venda atualizada com sucesso");
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a venda";
      toast.error(mensagem);
    } finally {
      setIsSubmitting(false);
    }
  }

  const conteudoFormulario = (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        {bloqueado && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Este mês está fechado — edição bloqueada.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="dataVenda"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data da venda</FormLabel>
                <FormControl
                  render={
                    <Input type="date" disabled={bloqueado} {...field} />
                  }
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mesReferencia"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mês de referência</FormLabel>
                <FormControl
                  render={
                    <Input
                      type="month"
                      disabled={bloqueado}
                      value={paraInputMonth(field.value)}
                      onChange={(e) =>
                        field.onChange(paraMesReferencia(e.target.value))
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
            name="alunoNome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Aluno</FormLabel>
                <FormControl
                  render={
                    <Input
                      placeholder="Nome do aluno"
                      disabled={bloqueado}
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
            name="pagadorNome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pagador</FormLabel>
                <FormControl
                  render={
                    <Input
                      placeholder="Nome do pagador"
                      disabled={bloqueado}
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
            name="plataforma"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Plataforma</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={bloqueado}
                  items={PLATAFORMAS}
                >
                  <FormControl
                    render={
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione a plataforma" />
                      </SelectTrigger>
                    }
                  />
                  <SelectContent>
                    {PLATAFORMAS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
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
            name="produtoId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Produto</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={bloqueado}
                  items={produtos.map((produto) => ({
                    value: produto.id,
                    label: produto.nome,
                  }))}
                >
                  <FormControl
                    render={
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                    }
                  />
                  <SelectContent>
                    {produtos.map((produto) => (
                      <SelectItem key={produto.id} value={produto.id}>
                        {produto.nome}
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
            name="tipoPagamento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de pagamento</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={bloqueado}
                  items={TIPOS_PAGAMENTO}
                >
                  <FormControl
                    render={
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    }
                  />
                  <SelectContent>
                    {TIPOS_PAGAMENTO.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
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
            name="valorTotal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor total (R$)</FormLabel>
                <FormControl
                  render={
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={bloqueado}
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

          {isMensalista && (
            <>
              <FormField
                control={form.control}
                name="entrada"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entrada (R$)</FormLabel>
                    <FormControl
                      render={
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={bloqueado}
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
                name="valorMensalidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da mensalidade (R$)</FormLabel>
                    <FormControl
                      render={
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={bloqueado}
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
                name="numeroParcelas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de parcelas</FormLabel>
                    <FormControl
                      render={
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          disabled={bloqueado}
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
            </>
          )}

          <FormField
            control={form.control}
            name="diaVencimento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dia de vencimento</FormLabel>
                <FormControl
                  render={
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      max="31"
                      disabled={bloqueado}
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
            name="closerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Closer</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={bloqueado}
                  items={closers.map((closer) => ({
                    value: closer.id,
                    label: closer.nome,
                  }))}
                >
                  <FormControl
                    render={
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o closer" />
                      </SelectTrigger>
                    }
                  />
                  <SelectContent>
                    {closers.map((closer) => (
                      <SelectItem key={closer.id} value={closer.id}>
                        {closer.nome}
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
            name="sdrId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SDR (opcional)</FormLabel>
                <Select
                  value={field.value ?? ""}
                  onValueChange={(value) =>
                    field.onChange(value === "" ? undefined : value)
                  }
                  disabled={bloqueado}
                  items={[
                    { value: "", label: "Nenhum" },
                    ...sdrs.map((sdr) => ({ value: sdr.id, label: sdr.nome })),
                  ]}
                >
                  <FormControl
                    render={
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                    }
                  />
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {sdrs.map((sdr) => (
                      <SelectItem key={sdr.id} value={sdr.id}>
                        {sdr.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="observacao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observação (opcional)</FormLabel>
              <FormControl
                render={
                  <Input
                    placeholder="Observações adicionais"
                    disabled={bloqueado}
                    {...field}
                    value={field.value ?? ""}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="submit" disabled={isSubmitting || bloqueado}>
            {isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );

  return (
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
        {mode === "criar" ? "Nova venda" : "Editar"}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "criar" ? "Nova venda" : "Editar venda"}
          </DialogTitle>
        </DialogHeader>

        {conteudoFormulario}
      </DialogContent>
    </Dialog>
  );
}
