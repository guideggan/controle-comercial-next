"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

// Toggle simples via querystring (v1.1) — mesma convenção de filtro do
// resto do app (a URL é a fonte da verdade, a page relê via searchParams).
// Colaboradores arquivados ficam escondidos por padrão; este botão liga a
// exibição via ?arquivados=1.
export function MostrarArquivadosToggle({
  mostrarArquivados,
  totalArquivados,
}: {
  mostrarArquivados: boolean;
  totalArquivados: number;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          router.push(
            mostrarArquivados ? "/colaboradores" : "/colaboradores?arquivados=1",
          )
        }
      >
        {mostrarArquivados
          ? "Ocultar arquivados"
          : `Mostrar arquivados (${totalArquivados})`}
      </Button>
    </div>
  );
}
