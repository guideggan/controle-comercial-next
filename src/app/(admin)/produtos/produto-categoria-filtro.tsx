"use client";

import { useRouter } from "next/navigation";
import type { CategoriaProduto } from "@prisma/client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Filtro de categoria (v1.1) — mesma convenção de filtro via querystring do
// resto do app (VendasFiltros): a URL é a fonte da verdade, a page relê via
// searchParams. "Todas" remove o filtro; "Sem categoria" mostra só o
// histórico importado sem categoria atribuída.

const OPCOES: { value: string; label: string }[] = [
  { value: "TODAS", label: "Todas as categorias" },
  { value: "ACELERACAO_MENTORIA", label: "Aceleração / Mentoria" },
  { value: "IMERSAO_PRESENCIAL", label: "Imersão presencial" },
  { value: "EVENTO_PRESENCIAL", label: "Evento presencial" },
];

export function ProdutoCategoriaFiltro({
  categoriaAtual,
  temSemCategoria,
}: {
  categoriaAtual: CategoriaProduto | "SEM_CATEGORIA" | null;
  temSemCategoria: boolean;
}) {
  const router = useRouter();

  const opcoes = temSemCategoria
    ? [...OPCOES, { value: "SEM_CATEGORIA", label: "Sem categoria (histórico)" }]
    : OPCOES;

  return (
    <div className="flex items-center gap-2">
      <Select
        value={categoriaAtual ?? "TODAS"}
        onValueChange={(value) => {
          router.push(value === "TODAS" ? "/produtos" : `/produtos?categoria=${value}`);
        }}
      >
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Todas as categorias" />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((opcao) => (
            <SelectItem key={opcao.value} value={opcao.value}>
              {opcao.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
