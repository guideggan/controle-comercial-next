"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import {
  vendaSchemaParaCloser,
  type VendaInput,
} from "@/server/actions/vendas.schemas";
import { criarVendaAction } from "@/server/actions/vendas.actions";
import { Button } from "@/components/ui/button";
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
import type { ProdutoOpcao, ColaboradorOpcao } from "@/app/(admin)/vendas/venda-form";

// Formulário de "Nova venda" do CLOSER (v1.1, VENDA-11/12) — variante
// enxuta do VendaForm admin: closerId é sempre o próprio colaborador da
// sessão (nem exibido como select, evitando qualquer tentativa de escolher
// outro closer no client — Pitfall 1/IDOR, o service também nunca
// confiaria nesse valor mesmo que viesse), linkCrm é OBRIGATÓRIO
// (vendaSchemaParaCloser) e não existe modo "editar" aqui — o closer só
// cria; edição/decisão fica com o admin.

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

// Mesmo motivo de VendaForm admin: .default() no schema faz o tipo de
// ENTRADA (z.input) divergir do tipo de SAÍDA (VendaInput) — o form usa
// sempre o tipo de entrada.
type VendaFormValues = z.input<typeof vendaSchemaParaCloser>;

function paraMesReferencia(mesAno: string): string {
  return `${mesAno}-01`;
}

function valoresPadrao(closerId: string): VendaFormValues {
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
    closerId,
    sdrId: undefined,
    observacao: undefined,
    linkCrm: "",
  };
}

export function NovaVendaCloserForm({
  produtos,
  sdrs,
  closerId,
}: {
  produtos: ProdutoOpcao[];
  sdrs: ColaboradorOpcao[];
  closerId: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<VendaFormValues, unknown, VendaInput>({
    resolver: zodResolver(vendaSchemaParaCloser),
    defaultValues: valoresPadrao(closerId),
  });

  const tipoPagamento = form.watch("tipoPagamento");
  const isMensalista = tipoPagamento === "MENSALISTA";

  async function onSubmit(values: VendaInput) {
    setIsSubmitting(true);
    try {
      await criarVendaAction({ ...values, closerId });
      toast.success(
        "Venda cadastrada — aguardando aprovação do admin.",
      );
      form.reset(valoresPadrao(closerId));
      router.push("/minhas-vendas");
      router.refresh();
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar a venda";
      toast.error(mensagem);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="dataVenda"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data da venda</FormLabel>
                <FormControl render={<Input type="date" {...field} />} />
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
                      value={field.value.slice(0, 7)}
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
                  render={<Input placeholder="Nome do aluno" {...field} />}
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
                  render={<Input placeholder="Nome do pagador" {...field} />}
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
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
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
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  }
                />
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

          <FormField
            control={form.control}
            name="linkCrm"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Link do CRM (obrigatório)</FormLabel>
                <FormControl
                  render={
                    <Input
                      placeholder="Cole aqui o link/card do CRM"
                      {...field}
                      value={field.value ?? ""}
                    />
                  }
                />
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
                    {...field}
                    value={field.value ?? ""}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Enviando..." : "Cadastrar venda"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
