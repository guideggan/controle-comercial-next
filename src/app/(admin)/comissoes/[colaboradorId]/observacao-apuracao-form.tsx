"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { definirObservacaoApuracaoAction } from "@/server/actions/apuracao.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Campo de observação livre por pessoa/mês (v1.1) — editável mesmo com o
// mês FECHADO (definirObservacaoApuracaoAction não passa pelo guard de mês
// fechado; é anotação humana, não recálculo, COMIS-06 protege só o valor
// calculado). Salva com um botão explícito (não onBlur), para o usuário ter
// controle claro de quando a anotação é gravada.
export function ObservacaoApuracaoForm({
  colaboradorId,
  mesReferencia,
  observacaoAtual,
}: {
  colaboradorId: string;
  mesReferencia: string;
  observacaoAtual: string | null;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(observacaoAtual ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const alterado = valor !== (observacaoAtual ?? "");

  async function onSalvar() {
    setIsSubmitting(true);
    try {
      await definirObservacaoApuracaoAction(
        colaboradorId,
        mesReferencia,
        valor.trim() === "" ? null : valor,
      );
      toast.success("Observação salva");
      router.refresh();
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a observação";
      toast.error(mensagem);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        placeholder="Anotação livre sobre esta apuração (opcional)"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="flex-1"
      />
      <Button
        type="button"
        size="sm"
        onClick={onSalvar}
        disabled={isSubmitting || !alterado}
      >
        {isSubmitting ? "Salvando..." : "Salvar observação"}
      </Button>
    </div>
  );
}
