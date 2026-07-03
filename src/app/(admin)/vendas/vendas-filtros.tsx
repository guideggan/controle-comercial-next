"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ColaboradorOpcao, ProdutoOpcao } from "@/app/(admin)/vendas/venda-form";

// Filtros da listagem de vendas (VENDA-05) — client component que lê/escreve
// a querystring via router.push, mesmo padrão de outros filtros client-side
// do projeto (ex.: nenhum estado de filtro fica só no client; a fonte da
// verdade é sempre a URL, para a page (Server Component) reler via
// searchParams e rechamar listarVendas).

const STATUS_OPCOES = [
  { value: "PENDENTE", label: "Pendente" },
  { value: "PAGO", label: "Pago" },
] as const;

export function VendasFiltros({
  produtos,
  closers,
}: {
  produtos: ProdutoOpcao[];
  closers: ColaboradorOpcao[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [aluno, setAluno] = useState(searchParams.get("aluno") ?? "");
  const [closerId, setCloserId] = useState(searchParams.get("closerId") ?? "");
  const [produtoId, setProdutoId] = useState(
    searchParams.get("produtoId") ?? "",
  );
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [mesReferencia, setMesReferencia] = useState(
    (searchParams.get("mesReferencia") ?? "").slice(0, 7),
  );

  const aplicarFiltros = useCallback(
    (overrides: Record<string, string> = {}) => {
      const valores: Record<string, string> = {
        aluno,
        closerId,
        produtoId,
        status,
        mesReferencia,
        ...overrides,
      };

      const params = new URLSearchParams();
      if (valores.aluno) params.set("aluno", valores.aluno);
      if (valores.closerId) params.set("closerId", valores.closerId);
      if (valores.produtoId) params.set("produtoId", valores.produtoId);
      if (valores.status) params.set("status", valores.status);
      if (valores.mesReferencia) {
        params.set("mesReferencia", `${valores.mesReferencia}-01`);
      }

      const querystring = params.toString();
      router.push(querystring ? `/vendas?${querystring}` : "/vendas");
    },
    [aluno, closerId, produtoId, status, mesReferencia, router],
  );

  function limparFiltros() {
    setAluno("");
    setCloserId("");
    setProdutoId("");
    setStatus("");
    setMesReferencia("");
    router.push("/vendas");
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Aluno
        </label>
        <Input
          placeholder="Buscar por aluno"
          value={aluno}
          onChange={(e) => setAluno(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") aplicarFiltros({ aluno });
          }}
          onBlur={() => aplicarFiltros({ aluno })}
          className="w-48"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Closer
        </label>
        <Select
          value={closerId || "TODOS"}
          onValueChange={(value) => {
            const proximo = value === "TODOS" || !value ? "" : value;
            setCloserId(proximo);
            aplicarFiltros({ closerId: proximo });
          }}
          items={[
            { value: "TODOS", label: "Todos" },
            ...closers.map((closer) => ({ value: closer.id, label: closer.nome })),
          ]}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            {closers.map((closer) => (
              <SelectItem key={closer.id} value={closer.id}>
                {closer.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Produto
        </label>
        <Select
          value={produtoId || "TODOS"}
          onValueChange={(value) => {
            const proximo = value === "TODOS" || !value ? "" : value;
            setProdutoId(proximo);
            aplicarFiltros({ produtoId: proximo });
          }}
          items={[
            { value: "TODOS", label: "Todos" },
            ...produtos.map((produto) => ({ value: produto.id, label: produto.nome })),
          ]}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            {produtos.map((produto) => (
              <SelectItem key={produto.id} value={produto.id}>
                {produto.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Status
        </label>
        <Select
          value={status || "TODOS"}
          onValueChange={(value) => {
            const proximo = value === "TODOS" || !value ? "" : value;
            setStatus(proximo);
            aplicarFiltros({ status: proximo });
          }}
          items={[
            { value: "TODOS", label: "Todos" },
            ...STATUS_OPCOES.map((opcao) => ({ value: opcao.value, label: opcao.label })),
          ]}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            {STATUS_OPCOES.map((opcao) => (
              <SelectItem key={opcao.value} value={opcao.value}>
                {opcao.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Mês de referência
        </label>
        <Input
          type="month"
          value={mesReferencia}
          onChange={(e) => {
            setMesReferencia(e.target.value);
            aplicarFiltros({ mesReferencia: e.target.value });
          }}
          className="w-40"
        />
      </div>

      <Button type="button" variant="outline" size="sm" onClick={limparFiltros}>
        Limpar filtros
      </Button>
    </div>
  );
}
