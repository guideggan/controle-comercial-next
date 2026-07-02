// Módulo PURO de domínio: proração semanal de meta mensal (Fase 6 —
// META-02/META-03, Pitfall 8). Sem `server-only`, sem import de
// `@prisma/client`/`@/lib/db` — mesmo padrão de
// src/domain/agendamentos/agregacao.ts e src/domain/recebimentos/agregacao.ts.
//
// REGRA DE PRORAÇÃO (decidida e documentada aqui, única fonte — Pitfall 8):
// As semanas do mês são blocos SEGUNDA A DOMINGO (calendário ISO), na mesma
// convenção de "segunda a sábado" já usada pelo grid de agendamentos
// (AGEND-03) — segunda é sempre o início da semana. Uma semana que começa
// antes do mês corrente ou termina depois dele é uma semana PARCIAL: só os
// dias que caem DENTRO do mês contam para a proração. A meta proporcional de
// cada semana é feita por DIAS CORRIDOS (não dias úteis): cada dia do mês
// vale `metaMensal / totalDiasDoMes`; a meta proporcional ACUMULADA de uma
// semana é a soma dos dias-de-mês de todas as semanas até e incluindo ela,
// vezes esse valor por dia. Isso garante que a última semana do mês sempre
// feche exatamente em metaMensal (sem drift de arredondamento acumulando
// erro visível: a proporção correta é sempre `diasAcumulados / totalDias`).
//
// Convenção de data (Pitfall 6): toda data é string "YYYY-MM-DD", nunca um
// `Date` ciente de timezone circulando pela aplicação.

export type SemanaProrateada = {
  numero: number; // 1-indexed, ordem cronológica dentro do mês
  inicio: string; // "YYYY-MM-DD" — pode ser antes do 1º dia do mês (semana parcial)
  fim: string; // "YYYY-MM-DD" — pode ser depois do último dia do mês (semana parcial)
  diasNoMes: number; // quantos dias desta semana caem dentro do mês de referência
  diasAcumuladosNoMes: number; // soma de diasNoMes desta semana + todas as anteriores
  percentualEsperado: number; // fração 0..1 — diasAcumuladosNoMes / totalDiasDoMes
  metaProporcionalAcumulada: number; // metaMensal * percentualEsperado, arredondado 1x
};

/**
 * Quebra uma meta mensal em metas semanais acumuladas proporcionais
 * (META-02), para o mês de competência informado ("YYYY-MM-01" ou
 * "YYYY-MM-DD", só ano/mês são usados). Pure function, sem I/O — testada
 * isoladamente contra meses reais.
 */
export function proracaoSemanal(
  metaMensal: number,
  mesReferencia: string,
): SemanaProrateada[] {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const totalDiasDoMes = ultimoDiaDoMes(ano, mes);

  const primeiroDiaDoMes = dataUTC(ano, mes, 1);
  const ultimoDiaDoMesData = dataUTC(ano, mes, totalDiasDoMes);

  // Segunda-feira que inicia a primeira semana (pode cair no mês anterior).
  const inicioPrimeiraSemana = segundaFeiraDaSemana(primeiroDiaDoMes);

  const semanas: SemanaProrateada[] = [];
  let cursor = inicioPrimeiraSemana;
  let diasAcumulados = 0;
  let numero = 1;

  while (cursor.getTime() <= ultimoDiaDoMesData.getTime()) {
    const fimSemana = somarDias(cursor, 6); // domingo desta semana

    const diasNoMes = contarDiasNoIntervaloDoMes(
      cursor,
      fimSemana,
      primeiroDiaDoMes,
      ultimoDiaDoMesData,
    );

    diasAcumulados += diasNoMes;
    const percentualEsperado = diasAcumulados / totalDiasDoMes;
    const metaProporcionalAcumulada = arredondar2(metaMensal * percentualEsperado);

    semanas.push({
      numero,
      inicio: formatarData(cursor),
      fim: formatarData(fimSemana),
      diasNoMes,
      diasAcumuladosNoMes: diasAcumulados,
      percentualEsperado,
      metaProporcionalAcumulada,
    });

    cursor = somarDias(cursor, 7);
    numero += 1;
  }

  return semanas;
}

// ---------------------------------------------------------------------------
// Helpers internos — todos operam sobre componentes UTC puros (Pitfall 6),
// nunca sobre Date local.

function dataUTC(ano: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  // Date.UTC(ano, mes, 0) = último dia do mês `mes` (1-indexed) — mesmo
  // padrão de ultimoDiaDoMes em src/domain/vendas/parcelas.ts (Pitfall 7).
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function somarDias(data: Date, dias: number): Date {
  const resultado = new Date(data);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}

// Segunda-feira da semana que contém `data` (mesma lógica ISO de
// calcularDiasSegundaASabado em agendamento.service.ts).
function segundaFeiraDaSemana(data: Date): Date {
  const diaSemanaISO = data.getUTCDay() === 0 ? 7 : data.getUTCDay(); // 1=segunda..7=domingo
  const offsetParaSegunda = diaSemanaISO - 1;
  return somarDias(data, -offsetParaSegunda);
}

function contarDiasNoIntervaloDoMes(
  inicioSemana: Date,
  fimSemana: Date,
  primeiroDiaDoMes: Date,
  ultimoDiaDoMesData: Date,
): number {
  const inicioEfetivo =
    inicioSemana.getTime() < primeiroDiaDoMes.getTime()
      ? primeiroDiaDoMes
      : inicioSemana;
  const fimEfetivo =
    fimSemana.getTime() > ultimoDiaDoMesData.getTime()
      ? ultimoDiaDoMesData
      : fimSemana;

  if (fimEfetivo.getTime() < inicioEfetivo.getTime()) return 0;

  const diffMs = fimEfetivo.getTime() - inicioEfetivo.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

function formatarData(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(data.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// Arredondamento único (COMIS-03 aplica o mesmo princípio aqui): a meta
// proporcional acumulada é arredondada 1x por semana a partir do valor cheio
// (metaMensal * fração), nunca por soma de arredondamentos parciais.
function arredondar2(valor: number): number {
  return Math.round(valor * 100) / 100;
}
