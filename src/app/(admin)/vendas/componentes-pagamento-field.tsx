"use client";

import { useFieldArray, type Control, type UseFormWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import type { z } from "zod";

import type { vendaSchema } from "@/server/actions/vendas.schemas";
import {
  EXPLICACAO_FORMA,
  FORMAS_PAGAMENTO,
  ROTULO_FORMA,
} from "@/server/actions/componentes.schemas";
import { contaCheioPorPadrao } from "@/domain/vendas/componentes";
import { formatarBRL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
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

// ============================================================
// PLANO DE PAGAMENTO — a regra de negócio na tela (Fase 11 / PGMT-01, 05)
// ============================================================
// Cada linha é um COMPONENTE da negociação. Uma venda pode ter vários:
//   Cliente A .... 72k PIX + 72k em 12x no cartão
//   Cliente E .... 5k de sinal + 25k em 03/08 + 30k de recorrência em 6x
//
// A UI mostra, em tempo real, o que a combinação escolhida significa: quanto
// é entrada garantida, se atinge os 50% obrigatórios, e quanto conta no mês.
// O objetivo é que quem lança a venda NÃO precise saber a regra de cor — a
// tela mostra a consequência de cada escolha.
//
// `contaCheioNoMes` NÃO é editável aqui de propósito: ele é derivado da forma
// (PIX/sinal/cartão parcelado contam cheio; boleto/recorrência não) e exibido
// como consequência, não como opção. Deixar isso editável na tela convidaria
// alguém a "resolver" um número que não fechou marcando a caixinha errada —
// que é exatamente o tipo de erro que a planilha permitia. O override existe
// no dado (para o caso raro), mas passa por script/admin, não pelo formulário.

type VendaFormValues = z.input<typeof vendaSchema>;

type Props = {
  control: Control<VendaFormValues>;
  watch: UseFormWatch<VendaFormValues>;
  desabilitado?: boolean;
};

export function ComponentesPagamentoField({
  control,
  watch,
  desabilitado = false,
}: Props) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "componentes",
  });

  const componentes = watch("componentes") ?? [];
  const valorTotal = Number(watch("valorTotal")) || 0;
  const mesReferencia = watch("mesReferencia") ?? "";

  // Resumo ao vivo. Recalculado a cada tecla — são no máximo ~3 linhas, o
  // custo é irrelevante e o feedback imediato é o ponto.
  const somaComponentes = componentes.reduce(
    (total, c) => total + (Number(c?.valor) || 0),
    0,
  );
  const entradaGarantida = componentes.reduce((total, c) => {
    if (!c?.forma) return total;
    const contaCheio = c.contaCheioNoMes ?? contaCheioPorPadrao(c.forma);
    return contaCheio ? total + (Number(c.valor) || 0) : total;
  }, 0);

  // Valor presente no mês da venda: componentes que contam cheio E estão
  // datados na competência da venda. Um componente datado em outro mês (o
  // caso da Rafaela, 25k em 03/08) aparece na entrada garantida mas NÃO no
  // valor presente deste mês — e a tela precisa deixar isso explícito.
  const mesDaVenda = mesReferencia.slice(0, 7);
  const valorPresenteNoMes = componentes.reduce((total, c) => {
    if (!c?.forma || !c?.dataPrevista) return total;
    const contaCheio = c.contaCheioNoMes ?? contaCheioPorPadrao(c.forma);
    if (!contaCheio) return total;
    if (c.dataPrevista.slice(0, 7) !== mesDaVenda) return total;
    return total + (Number(c.valor) || 0);
  }, 0);

  const percentualEntrada =
    somaComponentes > 0 ? entradaGarantida / somaComponentes : 0;
  const atingeMinimo = percentualEntrada + 0.0001 >= 0.5;
  const somaBate = Math.abs(somaComponentes - valorTotal) <= 0.01;
  const temComponentes = fields.length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Plano de pagamento</p>
          <p className="text-xs text-muted-foreground">
            Uma linha por forma de pagamento combinada com o cliente. É isto
            que define quanto a venda vale no mês.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={desabilitado}
          onClick={() =>
            append({
              forma: "PIX",
              valor: 0,
              parcelas: 1,
              // Sem data por padrão: o dia da venda quase nunca é o dia do
              // pagamento combinado, e preencher sozinho esconderia a
              // ressalva 3 (componente em outro mês não conta neste mês).
              dataPrevista: "",
              descricao: "",
            })
          }
        >
          <Plus className="size-4" />
          Adicionar forma de pagamento
        </Button>
      </div>

      {!temComponentes && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Sem plano de pagamento, a venda é salva no formato antigo (entrada +
          mensalidade) e <strong>não entra no cálculo de valor presente</strong>.
          Adicione as formas de pagamento para que o mês feche certo.
        </p>
      )}

      {fields.map((field, index) => {
        const forma = componentes[index]?.forma;
        const contaCheio = forma ? contaCheioPorPadrao(forma) : false;

        return (
          <div key={field.id} className="rounded-md border bg-muted/30 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <FormField
                  control={control}
                  name={`componentes.${index}.forma`}
                  render={({ field: campo }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Forma</FormLabel>
                      <Select
                        value={campo.value}
                        onValueChange={campo.onChange}
                        disabled={desabilitado}
                        items={FORMAS_PAGAMENTO.map((f) => ({
                          value: f,
                          label: ROTULO_FORMA[f],
                        }))}
                      >
                        <FormControl
                          render={
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          }
                        />
                        <SelectContent>
                          {FORMAS_PAGAMENTO.map((f) => (
                            <SelectItem key={f} value={f}>
                              {ROTULO_FORMA[f]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="sm:col-span-2">
                <FormField
                  control={control}
                  name={`componentes.${index}.valor`}
                  render={({ field: campo }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Valor (R$)</FormLabel>
                      <FormControl
                        render={
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            disabled={desabilitado}
                            {...campo}
                            onChange={(e) => campo.onChange(e.target.valueAsNumber)}
                          />
                        }
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="sm:col-span-2">
                <FormField
                  control={control}
                  name={`componentes.${index}.parcelas`}
                  render={({ field: campo }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Parcelas</FormLabel>
                      <FormControl
                        render={
                          <Input
                            type="number"
                            min="1"
                            max="120"
                            disabled={desabilitado}
                            {...campo}
                            onChange={(e) => campo.onChange(e.target.valueAsNumber)}
                          />
                        }
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="sm:col-span-3">
                <FormField
                  control={control}
                  name={`componentes.${index}.dataPrevista`}
                  render={({ field: campo }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Data do pagamento</FormLabel>
                      <FormControl
                        render={
                          <Input type="date" disabled={desabilitado} {...campo} />
                        }
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-end sm:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={desabilitado}
                  onClick={() => remove(index)}
                  aria-label="Remover forma de pagamento"
                >
                  <Trash2 className="size-4" />
                  Remover
                </Button>
              </div>

              <div className="sm:col-span-12">
                <FormField
                  control={control}
                  name={`componentes.${index}.descricao`}
                  render={({ field: campo }) => (
                    <FormItem>
                      <FormLabel className="text-xs">
                        Observação desta forma (opcional)
                      </FormLabel>
                      <FormControl
                        render={
                          <Input
                            placeholder="ex.: dividido em 3 cartões diferentes"
                            disabled={desabilitado}
                            {...campo}
                            value={campo.value ?? ""}
                          />
                        }
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {forma && (
              <div className="mt-2 flex items-start gap-2">
                {contaCheio ? (
                  <Badge>Conta cheio no mês</Badge>
                ) : (
                  <Badge variant="secondary">Conta parcela a parcela</Badge>
                )}
                <p className="text-xs text-muted-foreground">
                  {EXPLICACAO_FORMA[forma]}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {temComponentes && (
        <div className="grid grid-cols-1 gap-2 rounded-md border bg-background p-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Soma das formas</p>
            <p className={somaBate ? "font-medium" : "font-medium text-destructive"}>
              {formatarBRL(somaComponentes)}
            </p>
            {!somaBate && (
              <p className="text-xs text-destructive">
                Precisa fechar com o valor total ({formatarBRL(valorTotal)})
              </p>
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Entrada garantida</p>
            <p className={atingeMinimo ? "font-medium" : "font-medium text-destructive"}>
              {formatarBRL(entradaGarantida)}{" "}
              <span className="text-xs font-normal">
                ({(percentualEntrada * 100).toFixed(0)}%)
              </span>
            </p>
            {!atingeMinimo && (
              <p className="text-xs text-destructive">
                Mínimo de 50% do valor da venda
              </p>
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Valor presente neste mês
            </p>
            <p className="font-medium">{formatarBRL(valorPresenteNoMes)}</p>
            {valorPresenteNoMes < entradaGarantida && (
              <p className="text-xs text-muted-foreground">
                Parte da entrada está datada em outro mês e conta lá.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
