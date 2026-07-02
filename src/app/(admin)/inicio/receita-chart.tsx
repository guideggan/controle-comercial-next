"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatarBRL } from "@/lib/format";
import type { ReceitaMensalPonto } from "@/server/services/dashboard.service";

// Gráfico de receita dos últimos meses (dashboard do gestor, GESTOR-01) —
// mesmo padrão visual de MetaProgressoChart (Fase 8), plotando um AreaChart
// do Recharts a partir de dados já agregados pelo service (nunca recalcula
// aqui, só formata para exibição).
export function ReceitaChart({ pontos }: { pontos: ReceitaMensalPonto[] }) {
  const dados = pontos.map((p) => {
    const [ano, mes] = p.mes.split("-");
    return {
      mes: `${mes}/${ano.slice(2)}`,
      total: p.total,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={dados} margin={{ left: -16, right: 8 }}>
        <defs>
          <linearGradient id="receitaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="currentColor" stopOpacity={0.3} />
            <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="mes"
          tickLine={false}
          axisLine={false}
          className="text-xs fill-muted-foreground"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(valor: number) =>
            valor >= 1000 ? `${Math.round(valor / 1000)}k` : String(valor)
          }
          className="text-xs fill-muted-foreground"
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            background: "var(--color-popover)",
            color: "var(--color-popover-foreground)",
            fontSize: 12,
          }}
          formatter={(value) => [formatarBRL(Number(value)), "Receita"]}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="currentColor"
          strokeWidth={2}
          fill="url(#receitaGrad)"
          className="text-primary"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
