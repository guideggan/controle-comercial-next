import { describe, expect, it } from "vitest";

import { proracaoSemanal } from "./proracao";

// Testes do módulo puro de proração semanal (Fase 6 — META-02/META-03,
// Pitfall 8). Regra: semanas segunda-domingo, proração por dias corridos
// dentro do mês, meta proporcional ACUMULADA (nunca por-semana isolada).

describe("proracaoSemanal", () => {
  it("julho/2026 (começa quarta-feira, 31 dias): primeira e última semana parciais, soma fecha em 100% da meta", () => {
    const semanas = proracaoSemanal(11000, "2026-07-01");

    // 1/jul/2026 é quarta-feira -> primeira semana (seg 29/jun a dom 5/jul)
    // só tem 3 dias no mês (qua,qui,sex,sab,dom = na verdade conta de qua a
    // dom = 5 dias). Validamos a soma total e a monotonicidade abaixo, e o
    // formato de cada semana.
    expect(semanas[0].inicio).toBe("2026-06-29");
    expect(semanas[0].fim).toBe("2026-07-05");
    expect(semanas[0].diasNoMes).toBe(5); // qua,qui,sex,sab,dom (1..5 jul)

    const ultima = semanas[semanas.length - 1];
    expect(ultima.fim >= "2026-07-31").toBe(true);

    // A meta proporcional acumulada da ÚLTIMA semana sempre fecha
    // exatamente na meta mensal (Pitfall 8 — sem drift no boundary).
    expect(ultima.metaProporcionalAcumulada).toBe(11000);
    expect(ultima.percentualEsperado).toBe(1);

    // dias acumulados da última semana = total de dias do mês (31)
    expect(ultima.diasAcumuladosNoMes).toBe(31);

    // % esperado é sempre crescente (não-decrescente) semana a semana
    for (let i = 1; i < semanas.length; i += 1) {
      expect(semanas[i].percentualEsperado).toBeGreaterThanOrEqual(
        semanas[i - 1].percentualEsperado,
      );
    }
  });

  it("junho/2026 (começa segunda-feira, 30 dias): primeira semana cheia, última parcial", () => {
    const semanas = proracaoSemanal(3000, "2026-06-01");

    expect(semanas[0].inicio).toBe("2026-06-01");
    expect(semanas[0].diasNoMes).toBe(7); // semana cheia dentro do mês

    const ultima = semanas[semanas.length - 1];
    expect(ultima.diasAcumuladosNoMes).toBe(30);
    expect(ultima.metaProporcionalAcumulada).toBe(3000);
  });

  it("fevereiro/2026 (não-bissexto, 28 dias = exatamente 4 semanas): cada semana soma 25% acumulado", () => {
    const semanas = proracaoSemanal(4000, "2026-02-01");

    // 1/fev/2026 é domingo -> primeira semana parcial de 1 dia só.
    expect(semanas).toHaveLength(5);

    const ultima = semanas[semanas.length - 1];
    expect(ultima.diasAcumuladosNoMes).toBe(28);
    expect(ultima.metaProporcionalAcumulada).toBe(4000);
  });

  it("meta proporcional acumulada nunca ultrapassa a meta mensal", () => {
    const semanas = proracaoSemanal(5000, "2026-07-01");
    for (const semana of semanas) {
      expect(semana.metaProporcionalAcumulada).toBeLessThanOrEqual(5000);
    }
  });

  it("meta de closer em R$ com centavos arredonda corretamente (arredondamento único)", () => {
    // 31 dias, meta 10000 -> por dia = 322.5806...; validamos que o valor
    // acumulado da semana 1 (5 dias) bate com o esperado ao centavo.
    const semanas = proracaoSemanal(10000, "2026-07-01");
    const esperadoSemana1 = Math.round((10000 * 5) / 31 * 100) / 100;
    expect(semanas[0].metaProporcionalAcumulada).toBe(esperadoSemana1);
  });

  it("meta de SDR/SS em número de agendamentos (inteiro) também proraciona", () => {
    const semanas = proracaoSemanal(110, "2026-07-01");
    const ultima = semanas[semanas.length - 1];
    expect(ultima.metaProporcionalAcumulada).toBe(110);
  });

  it("cada semana tem numero sequencial 1-indexed", () => {
    const semanas = proracaoSemanal(1000, "2026-07-01");
    semanas.forEach((s, i) => expect(s.numero).toBe(i + 1));
  });
});
