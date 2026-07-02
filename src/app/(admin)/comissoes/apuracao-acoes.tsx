"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  apurarMesAction,
  fecharApuracaoAction,
  reabrirApuracaoAction,
} from "@/server/actions/apuracao.actions";
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

// Botões de apuração (COMIS-04/05/06): "Apurar mês" roda o motor via
// apurarMesAction; "Fechar mês"/"Reabrir mês" travam/destravam via
// AlertDialog de confirmação (fechar trava as vendas do mês inteiro, ação
// impactante o suficiente para exigir confirmação). Mesmo padrão de
// estado de submitting/toast/router.refresh() de parcela-pagamento-form.tsx.
export function ApuracaoAcoes({
  mes,
  fechado,
  temApuracao,
}: {
  mes: string;
  fechado: boolean;
  temApuracao: boolean;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onApurar() {
    setIsSubmitting(true);
    try {
      const resultado = await apurarMesAction(mes);
      toast.success(
        `Apuração concluída: ${resultado.apurados} colaborador(es) apurado(s)${
          resultado.pulados > 0
            ? `, ${resultado.pulados} sem plano vigente`
            : ""
        }.`,
      );
      router.refresh();
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível apurar o mês";
      toast.error(mensagem);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onFechar() {
    setIsSubmitting(true);
    try {
      await fecharApuracaoAction(mes);
      toast.success("Mês fechado — vendas e apuração travadas.");
      router.refresh();
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Não foi possível fechar o mês";
      toast.error(mensagem);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onReabrir() {
    setIsSubmitting(true);
    try {
      await reabrirApuracaoAction(mes);
      toast.success("Mês reaberto.");
      router.refresh();
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível reabrir o mês";
      toast.error(mensagem);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" onClick={onApurar} disabled={isSubmitting || fechado}>
        {isSubmitting ? "Apurando..." : "Apurar mês"}
      </Button>

      {!fechado && temApuracao && (
        <AlertDialog>
          <AlertDialogTrigger
            disabled={isSubmitting}
            render={<Button type="button" variant="outline" />}
          >
            Fechar mês
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Fechar apuração do mês?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso trava o mês e as vendas da competência — edições ficam
                bloqueadas até reabrir explicitamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onFechar}>
                Fechar mês
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {fechado && (
        <AlertDialog>
          <AlertDialogTrigger
            disabled={isSubmitting}
            render={<Button type="button" variant="outline" />}
          >
            Reabrir mês
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reabrir apuração do mês?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso destrava o mês e as vendas da competência para edição
                novamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onReabrir}>
                Reabrir mês
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
