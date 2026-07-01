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

// Gráfico de exemplo (Recharts) para validar o padrão de visualização do
// app shell — dados de EXEMPLO, claramente rotulados. Dados reais de
// progresso de meta/comissão chegam nas Fases 6/8 do roadmap.
const DADOS_EXEMPLO = [
  { mes: "Fev", valor: 42 },
  { mes: "Mar", valor: 58 },
  { mes: "Abr", valor: 51 },
  { mes: "Mai", valor: 67 },
  { mes: "Jun", valor: 74 },
  { mes: "Jul", valor: 83 },
];

export function MetaChart() {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={DADOS_EXEMPLO} margin={{ left: -16, right: 8 }}>
        <defs>
          <linearGradient id="metaExemplo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="currentColor" stopOpacity={0.25} />
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
          width={32}
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
          formatter={(value) => [`${value}%`, "Atingimento (exemplo)"]}
        />
        <Area
          type="monotone"
          dataKey="valor"
          stroke="currentColor"
          strokeWidth={2}
          fill="url(#metaExemplo)"
          className="text-primary"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
