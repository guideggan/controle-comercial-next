import { describe, expect, it, vi } from "vitest";

// Mocks precisam ser declarados antes do import do service (vi.mock é
// hoisted), mesmo padrão de apuracao.service.test.ts/recebimento.service.test.ts.
const listarAgendamentosDoColaboradorMock = vi.fn();
const listarAgendamentosDoMesMock = vi.fn();

vi.mock("@/server/repositories/agendamento.repo", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/repositories/agendamento.repo")
  >("@/server/repositories/agendamento.repo");
  return {
    ...actual,
    listarAgendamentosDoColaborador: (...args: unknown[]) =>
      listarAgendamentosDoColaboradorMock(...args),
    listarAgendamentosDoMes: (...args: unknown[]) =>
      listarAgendamentosDoMesMock(...args),
    criarAgendamentoRow: vi.fn(),
    getAgendamento: vi.fn(),
    atualizarStatusAgendamentoRow: vi.fn(),
  };
});

import { getGridSemanaCorrente } from "./agendamento.service";

// Testa a borda de calendário de calcularDiasSegundaASabado (função privada,
// exercitada indiretamente via getGridSemanaCorrente) — timezone-safe
// (Pitfall 6), inclusive quando `referencia` cai num domingo.

function dataUTC(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

describe("getGridSemanaCorrente — janela seg-sáb", () => {
  it("quando referência é quarta-feira, semana começa na segunda anterior", async () => {
    listarAgendamentosDoColaboradorMock.mockResolvedValue([]);

    // 2026-07-08 é uma quarta-feira
    const resultado = await getGridSemanaCorrente(
      "sdr-1",
      dataUTC("2026-07-08"),
    );

    expect(resultado.inicioSemana).toBe("2026-07-06"); // segunda
    expect(resultado.fimSemana).toBe("2026-07-11"); // sábado
    expect(resultado.dias).toHaveLength(6);
  });

  it("quando referência é domingo, semana é a que ACABOU de terminar (seg anterior a sáb anterior)", async () => {
    listarAgendamentosDoColaboradorMock.mockResolvedValue([]);

    // 2026-07-12 é um domingo
    const resultado = await getGridSemanaCorrente(
      "sdr-1",
      dataUTC("2026-07-12"),
    );

    expect(resultado.inicioSemana).toBe("2026-07-06");
    expect(resultado.fimSemana).toBe("2026-07-11");
  });

  it("quando referência é segunda-feira, semana começa nela mesma", async () => {
    listarAgendamentosDoColaboradorMock.mockResolvedValue([]);

    const resultado = await getGridSemanaCorrente(
      "sdr-1",
      dataUTC("2026-07-06"),
    );

    expect(resultado.inicioSemana).toBe("2026-07-06");
    expect(resultado.fimSemana).toBe("2026-07-11");
  });
});
