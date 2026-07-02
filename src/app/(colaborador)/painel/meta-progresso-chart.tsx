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

import type { AcompanhamentoSemana } from "@/server/services/meta.service";

// Gráfico real de progresso semanal (PAINEL-01) — substitui o gráfico de
// EXEMPLO da Fase 1.1 (meta-chart.tsx). Plota % esperado vs % atingido por
// semana, a partir de getAcompanhamentoMeta (nunca recalcula, só formata
// para o Recharts).
export function MetaProgressoChart({
  semanas,
}: {
  semanas: AcompanhamentoSemana[];
}) {
  const dados = semanas.map((s) => ({
    semana: `S${s.numero}`,
    esperado: Math.round(s.percentualEsperado * 1000) / 10,
    atingido: Math.round(s.percentualAtingido * 1000) / 10,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={dados} margin={{ left: -16, right: 8 }}>
        <defs>
          <linearGradient id="atingidoGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="currentColor" stopOpacity={0.3} />
            <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="semana"
          tickLine={false}
          axisLine={false}
          className="text-xs fill-muted-foreground"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          unit="%"
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
          formatter={(value, name) => [
            `${value}%`,
            name === "atingido" ? "% atingido" : "% esperado",
          ]}
        />
        <Area
          type="monotone"
          dataKey="esperado"
          stroke="var(--color-muted-foreground)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          fill="none"
        />
        <Area
          type="monotone"
          dataKey="atingido"
          stroke="currentColor"
          strokeWidth={2}
          fill="url(#atingidoGrad)"
          className="text-primary"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
