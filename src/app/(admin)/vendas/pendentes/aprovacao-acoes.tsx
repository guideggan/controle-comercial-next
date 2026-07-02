"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  aprovarVendaAction,
  rejeitarVendaAction,
} from "@/server/actions/vendas.actions";
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

// Botões Aprovar/Rejeitar da fila de aprovação (v1.1, VENDA-11). Aprovar é
// de 1 clique (baixo risco, reversível só rejeitando depois não é possível
// — mas aprovar uma venda legítima não exige confirmação extra); Rejeitar
// usa AlertDialog porque é uma decisão que descarta a venda.
export function AprovacaoAcoes({ vendaId }: { vendaId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onAprovar() {
    setIsSubmitting(true);
    try {
      await aprovarVendaAction(vendaId);
      toast.success("Venda aprovada");
      router.refresh();
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Não foi possível aprovar a venda";
      toast.error(mensagem);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onRejeitar() {
    setIsSubmitting(true);
    try {
      await rejeitarVendaAction(vendaId);
      toast.success("Venda rejeitada");
      router.refresh();
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Não foi possível rejeitar a venda";
      toast.error(mensagem);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        size="sm"
        onClick={onAprovar}
        disabled={isSubmitting}
      >
        Aprovar
      </Button>

      <AlertDialog>
        <AlertDialogTrigger
          disabled={isSubmitting}
          render={<Button type="button" variant="destructive" size="sm" />}
        >
          Rejeitar
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar esta venda?</AlertDialogTitle>
            <AlertDialogDescription>
              A venda ficará marcada como rejeitada e não entrará em
              receita/comissão/dashboard. Esta ação não pode ser desfeita
              pela tela — para reverter, será preciso ajuste manual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onRejeitar}>
              Rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
