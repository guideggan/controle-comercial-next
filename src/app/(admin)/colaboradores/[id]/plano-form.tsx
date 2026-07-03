"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";

import {
  criarPlanoComissaoSchema,
  type CriarPlanoComissaoInput,
} from "@/server/actions/planos-comissao.schemas";
import { definirPlanoComissaoAction } from "@/server/actions/planos-comissao.actions";
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

// Rótulos pt-BR dos 4 formatos de plano de comissão (COLAB-02..05) — mesmos
// literais de `tipo` do schema (fonte única: planos-comissao.schemas.ts).
const TIPOS_PLANO = [
  { value: "percentual_fixo", label: "% fixo sobre o recebido" },
  { value: "progressivo_atingimento", label: "Progressivo por atingimento" },
  { value: "fixo_variavel", label: "Fixo + variável" },
  { value: "por_calls", label: "Por calls realizadas" },
  {
    value: "salario_bonus_atingimento",
    label: "Salário fixo + bônus por atingimento",
  },
] as const;

type FormValues = {
  vigenciaInicio: string; // "YYYY-MM" vindo do input type="month"
  tipo: (typeof TIPOS_PLANO)[number]["value"];
  // Campos de todos os formatos ficam juntos aqui (form "solto"); o payload
  // final é remontado por tipo em onSubmit e validado de novo pelo schema
  // discriminado antes de ir para a Server Action.
  percentual: string; // percentual_fixo — em %, ex. "3" (convertido para 0.03 no submit)
  faixas: { deAtingimento: string; percentual: string }[]; // progressivo_atingimento
  valorFixo: string; // fixo_variavel
  percentualVariavel: string; // fixo_variavel — em %
  valorPorCall: string; // por_calls
  salarioFixo: string; // salario_bonus_atingimento — em R$
  // salario_bonus_atingimento — minAtingimento em % INTEIRO (ex. "71"), NÃO
  // convertido para fração no submit (diferente de faixas.deAtingimento
  // acima) — ver comentário de escala em planos-comissao.schemas.ts.
  faixasBonus: { minAtingimento: string; bonus: string }[];
};

function valoresPadrao(): FormValues {
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  return {
    vigenciaInicio: mesAtual,
    tipo: "percentual_fixo",
    percentual: "",
    faixas: [{ deAtingimento: "0", percentual: "" }],
    valorFixo: "",
    percentualVariavel: "",
    valorPorCall: "",
    salarioFixo: "",
    faixasBonus: [
      { minAtingimento: "0", bonus: "0" },
      { minAtingimento: "71", bonus: "2000" },
      { minAtingimento: "86", bonus: "3000" },
      { minAtingimento: "100", bonus: "4000" },
      { minAtingimento: "120", bonus: "5000" },
      { minAtingimento: "150", bonus: "8000" },
      { minAtingimento: "200", bonus: "12000" },
    ],
  };
}

// Converte "YYYY-MM" (input type="month") para "YYYY-MM-01" (convenção de
// vigenciaInicio do service — sempre o primeiro dia do mês, string pura,
// nunca via Date — PITFALLS Pitfall 6).
function paraVigenciaInicio(mesAno: string): string {
  return `${mesAno}-01`;
}

export function PlanoForm({
  colaboradorId,
  temPlanoVigente,
}: {
  colaboradorId: string;
  temPlanoVigente: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    defaultValues: valoresPadrao(),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "faixas",
  });

  const {
    fields: fieldsBonus,
    append: appendBonus,
    remove: removeBonus,
  } = useFieldArray({
    control: form.control,
    name: "faixasBonus",
  });

  const tipoSelecionado = form.watch("tipo");

  async function onSubmit(values: FormValues) {
    const base = {
      colaboradorId,
      vigenciaInicio: paraVigenciaInicio(values.vigenciaInicio),
    };

    let payload: CriarPlanoComissaoInput;

    if (values.tipo === "percentual_fixo") {
      payload = {
        ...base,
        tipo: "percentual_fixo",
        config: { percentual: Number(values.percentual) / 100 },
      };
    } else if (values.tipo === "progressivo_atingimento") {
      payload = {
        ...base,
        tipo: "progressivo_atingimento",
        config: {
          faixas: values.faixas.map((faixa) => ({
            deAtingimento: Number(faixa.deAtingimento) / 100,
            percentual: Number(faixa.percentual) / 100,
          })),
        },
      };
    } else if (values.tipo === "fixo_variavel") {
      payload = {
        ...base,
        tipo: "fixo_variavel",
        config: {
          valorFixo: Number(values.valorFixo),
          percentualVariavel: Number(values.percentualVariavel) / 100,
        },
      };
    } else if (values.tipo === "por_calls") {
      payload = {
        ...base,
        tipo: "por_calls",
        config: { valorPorCall: Number(values.valorPorCall) },
      };
    } else {
      payload = {
        ...base,
        tipo: "salario_bonus_atingimento",
        config: {
          salarioFixo: Number(values.salarioFixo),
          // minAtingimento fica em % INTEIRO (sem dividir por 100) —
          // convenção diferente de progressivo_atingimento (ver schema).
          faixas: values.faixasBonus.map((faixa) => ({
            minAtingimento: Number(faixa.minAtingimento),
            bonus: Number(faixa.bonus),
          })),
        },
      };
    }

    // Revalidação final contra o schema discriminado antes de chamar a
    // Server Action — o service também valida (fonte da verdade), mas
    // validar aqui também dá feedback de campo (ex.: faixas fora de ordem)
    // sem depender de round-trip ao servidor.
    const parsed = criarPlanoComissaoSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ?? "Dados do plano inválidos",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await definirPlanoComissaoAction(parsed.data);
      toast.success("Plano de comissão salvo com sucesso");
      setOpen(false);
      form.reset(valoresPadrao());
      router.refresh();
    } catch {
      toast.error("Não foi possível salvar o plano de comissão");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          form.reset(valoresPadrao());
        }
      }}
    >
      <DialogTrigger render={<Button type="button" />}>
        {temPlanoVigente ? "Trocar plano" : "Definir plano"}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {temPlanoVigente
              ? "Trocar plano de comissão"
              : "Definir plano de comissão"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="vigenciaInicio"
              rules={{ required: "Informe o mês de início da vigência" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vigência a partir de</FormLabel>
                  <FormControl render={<Input type="month" {...field} />} />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Formato do plano</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={TIPOS_PLANO}
                  >
                    <FormControl
                      render={
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o formato" />
                        </SelectTrigger>
                      }
                    />
                    <SelectContent>
                      {TIPOS_PLANO.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {tipoSelecionado === "percentual_fixo" && (
              <FormField
                control={form.control}
                name="percentual"
                rules={{ required: "Informe o percentual" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Percentual sobre o recebido (%)</FormLabel>
                    <FormControl
                      render={
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Ex.: 3"
                          {...field}
                        />
                      }
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {tipoSelecionado === "progressivo_atingimento" && (
              <div className="flex flex-col gap-3">
                <FormLabel>Faixas de atingimento</FormLabel>
                {fields.map((item, index) => (
                  <div key={item.id} className="flex items-end gap-2">
                    <FormField
                      control={form.control}
                      name={`faixas.${index}.deAtingimento`}
                      rules={{ required: "Obrigatório" }}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs font-normal text-muted-foreground">
                            A partir de (% da meta)
                          </FormLabel>
                          <FormControl
                            render={
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Ex.: 70"
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
                      name={`faixas.${index}.percentual`}
                      rules={{ required: "Obrigatório" }}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs font-normal text-muted-foreground">
                            Percentual (%)
                          </FormLabel>
                          <FormControl
                            render={
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Ex.: 1,5"
                                {...field}
                              />
                            }
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={fields.length <= 1}
                      onClick={() => remove(index)}
                      aria-label="Remover faixa"
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({ deAtingimento: "", percentual: "" })
                  }
                >
                  <PlusIcon /> Adicionar faixa
                </Button>
              </div>
            )}

            {tipoSelecionado === "fixo_variavel" && (
              <>
                <FormField
                  control={form.control}
                  name="valorFixo"
                  rules={{ required: "Informe o valor fixo" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor fixo (R$)</FormLabel>
                      <FormControl
                        render={
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Ex.: 2000"
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
                  name="percentualVariavel"
                  rules={{ required: "Informe o percentual variável" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Percentual variável (%)</FormLabel>
                      <FormControl
                        render={
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Ex.: 1"
                            {...field}
                          />
                        }
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {tipoSelecionado === "por_calls" && (
              <FormField
                control={form.control}
                name="valorPorCall"
                rules={{ required: "Informe o valor por call" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor por call (R$)</FormLabel>
                    <FormControl
                      render={
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Ex.: 15"
                          {...field}
                        />
                      }
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {tipoSelecionado === "salario_bonus_atingimento" && (
              <>
                <FormField
                  control={form.control}
                  name="salarioFixo"
                  rules={{ required: "Informe o salário fixo" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salário fixo (R$)</FormLabel>
                      <FormControl
                        render={
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Ex.: 4000"
                            {...field}
                          />
                        }
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col gap-3">
                  <FormLabel>Bônus por faixa de atingimento da meta</FormLabel>
                  {fieldsBonus.map((item, index) => (
                    <div key={item.id} className="flex items-end gap-2">
                      <FormField
                        control={form.control}
                        name={`faixasBonus.${index}.minAtingimento`}
                        rules={{ required: "Obrigatório" }}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-xs font-normal text-muted-foreground">
                              A partir de (% da meta)
                            </FormLabel>
                            <FormControl
                              render={
                                <Input
                                  type="number"
                                  step="1"
                                  min="0"
                                  placeholder="Ex.: 71"
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
                        name={`faixasBonus.${index}.bonus`}
                        rules={{ required: "Obrigatório" }}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-xs font-normal text-muted-foreground">
                              Bônus (R$)
                            </FormLabel>
                            <FormControl
                              render={
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="Ex.: 2000"
                                  {...field}
                                />
                              }
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={fieldsBonus.length <= 1}
                        onClick={() => removeBonus(index)}
                        aria-label="Remover faixa"
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendBonus({ minAtingimento: "", bonus: "" })
                    }
                  >
                    <PlusIcon /> Adicionar faixa
                  </Button>
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar plano"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
