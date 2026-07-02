import "server-only";

import type { StatusAgendamento } from "@prisma/client";

import {
  criarAgendamentoRow,
  getAgendamento,
  atualizarStatusAgendamentoRow,
  listarAgendamentosDoColaborador,
  listarAgendamentosDoMes,
  dataParaString,
} from "@/server/repositories/agendamento.repo";
import {
  criarAgendamentoSchema,
  type CriarAgendamentoInput,
} from "@/server/actions/agendamentos.schemas";
import {
  agregarPorDiaDaSemana,
  contarCallsRealizadas as contarCallsRealizadasPuro,
  type AgendamentoLinha,
  type DiaSemanaGrid,
} from "@/domain/agendamentos/agregacao";

// Fachada pública da Fase 7 (AGEND-01/02/03), consumida pelas Server
// Actions (agendamentos.actions.ts) — mesmo padrão de recebimento.service.ts.
// NÃO faz authz aqui (fica nas actions); este service só valida, converte
// Decimal/Date <-> string na borda e delega a contagem/agregação para o
// módulo puro (nunca reimplementa a soma).

export async function criarAgendamento(
  colaboradorId: string,
  input: CriarAgendamentoInput,
) {
  const parsed = criarAgendamentoSchema.parse(input);

  return criarAgendamentoRow({
    colaboradorId,
    data: parsed.data,
    status: parsed.status,
    observacao: parsed.observacao,
  });
}

export async function atualizarStatusAgendamento(
  id: string,
  status: StatusAgendamento,
) {
  const agendamento = await getAgendamento(id);
  if (!agendamento) {
    throw new Error("Agendamento não encontrado");
  }
  return atualizarStatusAgendamentoRow(id, status);
}

export type AgendamentoDoColaborador = {
  id: string;
  colaboradorId: string;
  data: string;
  status: StatusAgendamento;
  observacao: string | null;
};

export async function listarAgendamentos(
  colaboradorId: string,
  dataInicio: string,
  dataFim: string,
): Promise<AgendamentoDoColaborador[]> {
  const linhas = await listarAgendamentosDoColaborador(
    colaboradorId,
    dataInicio,
    dataFim,
  );
  return linhas.map((a) => ({
    id: a.id,
    colaboradorId: a.colaboradorId,
    data: dataParaString(a.data),
    status: a.status,
    observacao: a.observacao,
  }));
}

// FONTE ÚNICA de contagem de calls realizadas no mês (AGEND-02) — consumida
// tanto pela apuração por_calls (src/server/services/apuracao.service.ts)
// quanto pelo painel de meta (Fase 6/8). Nunca reimplementar esta soma em
// outro lugar: qualquer consumidor que precise desse número chama esta
// função.
export async function contarCallsRealizadas(
  colaboradorId: string,
  mesReferencia: string,
): Promise<number> {
  const linhasDoMes = await listarAgendamentosDoMes(mesReferencia);
  const agendamentos: AgendamentoLinha[] = linhasDoMes.map((a) => ({
    id: a.id,
    colaboradorId: a.colaboradorId,
    data: dataParaString(a.data),
    status: a.status,
  }));

  return contarCallsRealizadasPuro(agendamentos, colaboradorId, mesReferencia);
}

export type SemanaCorrenteGrid = {
  inicioSemana: string;
  fimSemana: string;
  dias: DiaSemanaGrid[];
};

// Painel agendadas x realizadas por dia da semana corrente (AGEND-03),
// segunda a sábado. Calcula a janela de calendário (borda de Date fica
// aqui, fora do domínio puro) e delega a agregação para
// agregarPorDiaDaSemana.
export async function getGridSemanaCorrente(
  colaboradorId: string,
  referencia: Date = new Date(),
): Promise<SemanaCorrenteGrid> {
  const diasDaSemana = calcularDiasSegundaASabado(referencia);
  const inicioSemana = diasDaSemana[0];
  const fimSemana = diasDaSemana[diasDaSemana.length - 1];

  const linhas = await listarAgendamentosDoColaborador(
    colaboradorId,
    inicioSemana,
    fimSemana,
  );
  const agendamentos: AgendamentoLinha[] = linhas.map((a) => ({
    id: a.id,
    colaboradorId: a.colaboradorId,
    data: dataParaString(a.data),
    status: a.status,
  }));

  const dias = agregarPorDiaDaSemana(agendamentos, colaboradorId, diasDaSemana);

  return { inicioSemana, fimSemana, dias };
}

// Calcula as 6 datas "YYYY-MM-DD" de segunda a sábado da semana que contém
// `referencia`, timezone-safe (opera só sobre os componentes UTC da data
// atual do processo, mesma convenção de mesCorrenteUTC() em comissoes/page.tsx
// — Pitfall 6). Domingo (getUTCDay()===0) conta como fim da semana anterior,
// então a segunda-feira é sempre "referencia - (diaSemana - 1)" dias, exceto
// quando diaSemana===0 (domingo), tratado como se fosse dia 7.
function calcularDiasSegundaASabado(referencia: Date): string[] {
  const ano = referencia.getUTCFullYear();
  const mes = referencia.getUTCMonth();
  const dia = referencia.getUTCDate();
  const hoje = new Date(Date.UTC(ano, mes, dia));

  const diaSemanaISO = hoje.getUTCDay() === 0 ? 7 : hoje.getUTCDay(); // 1=segunda..7=domingo
  const offsetParaSegunda = diaSemanaISO - 1;

  const segunda = new Date(hoje);
  segunda.setUTCDate(segunda.getUTCDate() - offsetParaSegunda);

  const dias: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(segunda);
    d.setUTCDate(d.getUTCDate() + i);
    dias.push(dataParaString(d));
  }
  return dias;
}
