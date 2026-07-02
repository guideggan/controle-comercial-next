"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Botão preto "Exportar relatório" (AUDIT-02) — espelha o botão primário do
// app de referência (DRE Consolidado). Cada item baixa um CSV distinto via
// GET /api/export/[dataset]?mes=..., autenticado pela mesma sessão de
// cookie do navegador (rota gated por requireRole("ADMIN") no servidor).
export function ExportarRelatorio({ mes }: { mes: string }) {
  const baseHref = `/api/export`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="default">
            <Download />
            Exportar relatório
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuLinkItem href={`${baseHref}/vendas?mes=${mes}`} download>
          Vendas (.csv)
        </DropdownMenuLinkItem>
        <DropdownMenuLinkItem href={`${baseHref}/comissoes?mes=${mes}`} download>
          Comissões (.csv)
        </DropdownMenuLinkItem>
        <DropdownMenuLinkItem href={`${baseHref}/metas?mes=${mes}`} download>
          Metas (.csv)
        </DropdownMenuLinkItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
