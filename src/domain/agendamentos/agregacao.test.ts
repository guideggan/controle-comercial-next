import { describe, expect, it } from "vitest";

import {
  agregarPorDiaDaSemana,
  contarCallsRealizadas,
  type AgendamentoLinha,
} from "./agregacao";

// Testes do módulo puro de agregação de agendamentos (Fase 7 — AGEND-02/03).
// contarCallsRealizadas é a FONTE ÚNICA usada tanto pela apuração por_calls
// quanto pelo painel de meta — por isso testada isoladamente antes de
// qualquer wiring de banco.

describe("contarCallsRealizadas", () => {
  const base: AgendamentoLinha[] = [
    { id: "1", colaboradorId: "sdr-1", data: "2026-07-02", status: "REALIZADO" },
    { id: "2", colaboradorId: "sdr-1", data: "2026-07-05", status: "REALIZADO" },
    { id: "3", colaboradorId: "sdr-1", data: "2026-07-10", status: "NO_SHOW" },
    { id: "4", colaboradorId: "sdr-1", data: "2026-07-15", status: "AGENDADO" },
    { id: "5", colaboradorId: "sdr-1", data: "2026-07-20", status: "CANCELADO" },
    { id: "6", colaboradorId: "sdr-2", data: "2026-07-02", status: "REALIZADO" },
    { id: "7", colaboradorId: "sdr-1", data: "2026-06-30", status: "REALIZADO" },
  ];

  it("conta apenas REALIZADO no mês e colaborador informados", () => {
    expect(contarCallsRealizadas(base, "sdr-1", "2026-07-01")).toBe(2);
  });

  it("não conta REALIZADO de outro colaborador", () => {
    expect(contarCallsRealizadas(base, "sdr-2", "2026-07-01")).toBe(1);
  });

  it("não conta REALIZADO de outro mês (competência exata)", () => {
    expect(contarCallsRealizadas(base, "sdr-1", "2026-06-01")).toBe(1);
  });

  it("retorna 0 quando não há agendamentos", () => {
    expect(contarCallsRealizadas([], "sdr-1", "2026-07-01")).toBe(0);
  });

  it("dedup por id: mesma linha duplicada conta uma única vez", () => {
    const duplicado = [...base, base[0]];
    expect(contarCallsRealizadas(duplicado, "sdr-1", "2026-07-01")).toBe(2);
  });
});

describe("agregarPorDiaDaSemana", () => {
  const diasDaSemana = [
    "2026-07-06", // segunda
    "2026-07-07",
    "2026-07-08",
    "2026-07-09",
    "2026-07-10",
    "2026-07-11", // sábado
  ];

  const agendamentos: AgendamentoLinha[] = [
    { id: "1", colaboradorId: "sdr-1", data: "2026-07-06", status: "REALIZADO" },
    { id: "2", colaboradorId: "sdr-1", data: "2026-07-06", status: "NO_SHOW" },
    { id: "3", colaboradorId: "sdr-1", data: "2026-07-07", status: "AGENDADO" },
    { id: "4", colaboradorId: "sdr-1", data: "2026-07-07", status: "CANCELADO" },
    { id: "5", colaboradorId: "sdr-2", data: "2026-07-06", status: "REALIZADO" },
  ];

  it("agrega agendadas/realizadas/no-show/cancelado por dia, seg-sáb", () => {
    const grid = agregarPorDiaDaSemana(agendamentos, "sdr-1", diasDaSemana);

    expect(grid).toHaveLength(6);

    // segunda: 1 REALIZADO + 1 NO_SHOW = 2 agendadas (nenhum cancelado), 1 realizada
    expect(grid[0]).toMatchObject({
      data: "2026-07-06",
      agendadas: 2,
      realizadas: 1,
      noShow: 1,
      cancelado: 0,
    });

    // terça: 1 AGENDADO + 1 CANCELADO = agendadas conta só o não-cancelado (1)
    expect(grid[1]).toMatchObject({
      data: "2026-07-07",
      agendadas: 1,
      realizadas: 0,
      cancelado: 1,
    });

    // dias sem agendamento ficam zerados
    expect(grid[2]).toMatchObject({
      data: "2026-07-08",
      agendadas: 0,
      realizadas: 0,
    });
  });

  it("não mistura agendamentos de outro colaborador", () => {
    const grid = agregarPorDiaDaSemana(agendamentos, "sdr-2", diasDaSemana);
    expect(grid[0].realizadas).toBe(1);
    expect(grid[0].agendadas).toBe(1);
  });
});
