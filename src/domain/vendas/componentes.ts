// Módulo PURO de domínio: componentes do plano de pagamento de uma venda
// (Fase 11 / PGMT-01..06). Sem `server-only`, sem import de
// `@prisma/client`/`@/lib/db` — mesmo padrão de parcelas.ts, testável
// isoladamente e reutilizável pelo backfill de histórico.
//
// ============================================================
// POR QUE ESTE MÓDULO EXISTE
// ============================================================
// Até a Fase 10 a venda era descrita por três campos escalares (`entrada`,
// `valorMensalidade`, `numeroParcelas`), o que só comporta UMA entrada e UMA
// recorrência. Negociações reais não cabem nisso:
//   - "72k PIX + 72k em 12x no cartão"            → 2 componentes
//   - "5k de sinal + 25k em 03/08 + 30k em 6x"     → 3 componentes, datas diferentes
//   - "50k em 3 cartões 12x + 46k em boleto"       → componentes em meses diferentes
// Achatar isso num par de números é exatamente a interpretação humana que o
// sistema existe para eliminar.
//
// ============================================================
// A REGRA (confirmada com a gestão em 2026-08-02)
// ============================================================
// O que decide se o dinheiro conta cheio no mês NÃO é a forma de pagamento em
// si — é a Next já ter garantido o recebimento:
//
//   PIX / sinal ................. o dinheiro caiu. conta cheio.
//   cartão parcelado (12x) ...... a operadora aprovou a compra inteira de uma
//                                 vez; o cliente não cancela o que falta.
//                                 conta cheio.
//   boleto parcelado ............ o cliente pode simplesmente não pagar o
//                                 próximo. conta boleto a boleto.
//   recorrência / assinatura .... o cliente cancela quando quiser.
//                                 conta parcela a parcela.
//
// Cartão aparece dos DOIS lados: parcelado em transação única conta cheio;
// assinatura recorrente não. Por isso o discriminante é um campo próprio
// (`contaCheioNoMes`) e não um `switch` na forma espalhado pelo código.
//
// As "4 ressalvas" da §2 de docs/APURACAO-COMERCIAL-NEXT.md são consequência
// dessa regra única, não quatro casos independentes — ver valor-presente.ts.

/** Formas de pagamento que um componente pode ter. Espelha o enum
 * FormaPagamento do Prisma (mesmos literais). */
export type FormaPagamento =
  | "PIX"
  | "SINAL"
  | "CARTAO_PARCELADO"
  | "BOLETO"
  | "RECORRENCIA";

/**
 * Se a forma, por padrão, garante o recebimento (conta cheio no mês) ou não.
 *
 * É um DEFAULT, não uma verdade imutável: o valor efetivo vive em
 * `ComponentePagamento.contaCheioNoMes`, gravado explicitamente em cada
 * componente. Isso permite o caso raro que foge do padrão (ex.: um boleto
 * único já compensado no ato) sem precisar de migração nem de uma forma nova.
 */
export const CONTA_CHEIO_POR_PADRAO: Record<FormaPagamento, boolean> = {
  PIX: true,
  SINAL: true,
  CARTAO_PARCELADO: true,
  BOLETO: false,
  RECORRENCIA: false,
};

export function contaCheioPorPadrao(forma: FormaPagamento): boolean {
  return CONTA_CHEIO_POR_PADRAO[forma];
}

export interface ComponentePagamento {
  forma: FormaPagamento;
  /** Se conta cheio no mês da `dataPrevista` (true) ou parcela a parcela
   * conforme for recebido (false). Default derivado da forma, mas SEMPRE
   * explícito no dado. */
  contaCheioNoMes: boolean;
  /** Valor TOTAL do componente (não o valor da parcela). */
  valor: number;
  /** Em quantas parcelas o componente é cobrado. 1 = à vista. */
  parcelas: number;
  /** "YYYY-MM-DD" — a data DESTE componente, que pode ser diferente da data
   * da venda e de outros componentes (é o que resolve a ressalva 3: pagamento
   * com data em outro mês não conta no mês do fechamento). */
  dataPrevista: string;
  /** Texto livre para explicar a negociação ("3 cartões diferentes", "boleto
   * em aberto com o financeiro"). Negociações fora do padrão são comuns e
   * precisam ser explicáveis — antes disso, só existiam no WhatsApp. */
  descricao?: string | null;
}

/** Valor de cada parcela do componente. Divisão simples; a sobra de
 * arredondamento é tratada em `gerarCronogramaDeComponentes` (a última
 * parcela absorve os centavos, para a soma das parcelas fechar exatamente o
 * valor do componente). */
export function valorDaParcela(componente: ComponentePagamento): number {
  if (componente.parcelas <= 1) return componente.valor;
  return componente.valor / componente.parcelas;
}

/** TCV = soma de todos os componentes, independente de data ou de contar
 * cheio. É o valor do contrato assinado. */
export function calcularTcv(componentes: ComponentePagamento[]): number {
  return componentes.reduce((total, c) => total + c.valor, 0);
}

/** Soma dos componentes que contam cheio — a "entrada" no sentido da política
 * comercial (o que a Next garantiu no ato da venda), independente de estar
 * dividida em quantos componentes. */
export function calcularEntradaGarantida(
  componentes: ComponentePagamento[],
): number {
  return componentes
    .filter((c) => c.contaCheioNoMes)
    .reduce((total, c) => total + c.valor, 0);
}

// ============================================================
// VALIDAÇÃO DE POLÍTICA COMERCIAL (PGMT-05)
// ============================================================
// "Toda venda exige no mínimo 50% de entrada" — confirmado com a gestão em
// 2026-08-02. A Next não aceita mais venda 100% recorrência.
//
// Consequência: a ressalva (4) do documento de apuração ("venda 100%
// recorrência conta 1 parcela") vira regra apenas HISTÓRICA. Vendas antigas
// que violam esta política (ex.: Vanessa Militani, julho/2026) continuam
// válidas no banco — por isso a validação é aplicada no CADASTRO NOVO, nunca
// na leitura nem no backfill.

export const PERCENTUAL_MINIMO_ENTRADA = 0.5;

export type ResultadoValidacao =
  | { valido: true }
  | { valido: false; motivo: string };

/**
 * Valida a política de entrada mínima de 50% do TCV para uma venda NOVA.
 *
 * Nunca chamada para histórico/backfill: vendas anteriores a esta política
 * existem no banco e precisam continuar existindo (PGMT-07).
 */
export function validarEntradaMinima(
  componentes: ComponentePagamento[],
): ResultadoValidacao {
  const tcv = calcularTcv(componentes);
  if (tcv <= 0) {
    return { valido: false, motivo: "A venda precisa ter valor maior que zero" };
  }

  const entrada = calcularEntradaGarantida(componentes);
  const minimo = tcv * PERCENTUAL_MINIMO_ENTRADA;

  // Tolerância de 1 centavo: uma entrada de exatamente 50% pode cair um
  // centavo abaixo por arredondamento de divisão (ex.: TCV ímpar), e recusar
  // a venda por isso seria um falso positivo.
  if (entrada + 0.01 < minimo) {
    return {
      valido: false,
      motivo:
        `A entrada precisa ser de no mínimo 50% do valor da venda. ` +
        `Entrada informada: ${formatarValor(entrada)} de ${formatarValor(tcv)} ` +
        `(mínimo ${formatarValor(minimo)}).`,
    };
  }

  return { valido: true };
}

/** Formatação mínima só para a mensagem de erro do domínio — sem Intl/locale
 * (o módulo é puro e roda em qualquer runtime); a UI formata de novo. */
function formatarValor(valor: number): string {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

// ============================================================
// CRONOGRAMA DE PARCELAS A PARTIR DOS COMPONENTES (PGMT-06)
// ============================================================
// IMPORTANTE — decisão de escopo da Fase 11 (zero regressão):
//
// Um componente que conta cheio gera UMA parcela no mês da sua data, com o
// valor cheio — exatamente como a venda "À vista" do v1 já fazia. NÃO
// decompomos o cartão 12x em 12 parcelas de caixa nesta fase, porque isso
// mudaria `recebidoNoMes` e, com ele, a comissão de todo mundo, ANTES de a
// Fase 13 trocar a base de comissão para valor presente. A decomposição real
// do cartão em parcelas de caixa entra na Fase 15, quando o extrato do Asaas
// passar a ser a fonte dessas parcelas.
//
// Numeração: `numero` é sequencial POR TIPO dentro da venda, atravessando
// componentes (componente A gera MENSALIDADE 1..10, componente B segue em
// 11..22). Isso preserva a unique key existente `[vendaId, tipo, numero]`
// mesmo com N componentes — a origem real de cada parcela é rastreada por
// `componenteIndice`, não pela numeração.

export type TipoParcela = "ENTRADA" | "MENSALIDADE" | "AVISTA";

export interface ParcelaDeComponente {
  tipo: TipoParcela;
  numero: number;
  /** "YYYY-MM-01" */
  mesReferencia: string;
  /** "YYYY-MM-DD" */
  dataVencimento: string;
  valorPrevisto: number;
  /** Índice do componente que originou esta parcela, na ordem do array de
   * entrada — o caller (service) usa para ligar a parcela ao
   * `ComponentePagamento` persistido. */
  componenteIndice: number;
}

/**
 * Gera o cronograma de parcelas de uma venda a partir dos seus componentes.
 *
 * - Componente que conta cheio → 1 parcela no mês da `dataPrevista`.
 *   Tipo `AVISTA` quando a venda NÃO tem nenhum componente parcelado a
 *   receber; `ENTRADA` quando tem (preserva o split à vista × mensalista do
 *   dashboard, GESTOR-01).
 * - Componente que não conta cheio → N parcelas `MENSALIDADE` mensais a
 *   partir do mês da `dataPrevista`, com o dia ancorado (Pitfall 7).
 *
 * A última parcela de cada componente absorve a sobra de arredondamento, para
 * a soma das parcelas fechar EXATAMENTE o valor do componente.
 */
export function gerarCronogramaDeComponentes(
  componentes: ComponentePagamento[],
): ParcelaDeComponente[] {
  const temParcelado = componentes.some((c) => !c.contaCheioNoMes);
  const tipoDoCheio: TipoParcela = temParcelado ? "ENTRADA" : "AVISTA";

  const parcelas: ParcelaDeComponente[] = [];

  // Contadores independentes por tipo — garantem `numero` único dentro do
  // par (vendaId, tipo) mesmo com vários componentes do mesmo lado.
  let proximoNumeroCheio = 0; // ENTRADA/AVISTA começam em 0 (convenção do v1)
  let proximoNumeroMensalidade = 1; // MENSALIDADE começa em 1 (convenção do v1)

  componentes.forEach((componente, componenteIndice) => {
    if (componente.contaCheioNoMes) {
      parcelas.push({
        tipo: tipoDoCheio,
        numero: proximoNumeroCheio,
        mesReferencia: mesDaData(componente.dataPrevista),
        dataVencimento: componente.dataPrevista,
        valorPrevisto: arredondarCentavos(componente.valor),
        componenteIndice,
      });
      proximoNumeroCheio += 1;
      return;
    }

    const diaAncora = diaDaData(componente.dataPrevista);
    const valorParcela = arredondarCentavos(valorDaParcela(componente));
    let mesCorrente = mesDaData(componente.dataPrevista);
    let acumulado = 0;

    for (let i = 1; i <= componente.parcelas; i++) {
      const ehUltima = i === componente.parcelas;
      // A última parcela recebe o resto exato, para a soma fechar o valor do
      // componente ao centavo mesmo quando a divisão não é exata
      // (ex.: 46.000 / 12 = 3.833,3333...).
      const valorPrevisto = ehUltima
        ? arredondarCentavos(componente.valor - acumulado)
        : valorParcela;
      acumulado += valorPrevisto;

      parcelas.push({
        tipo: "MENSALIDADE",
        numero: proximoNumeroMensalidade,
        mesReferencia: mesCorrente,
        dataVencimento: dataVencimentoAncorada(mesCorrente, diaAncora),
        valorPrevisto,
        componenteIndice,
      });

      proximoNumeroMensalidade += 1;
      mesCorrente = proximoMes(mesCorrente);
    }
  });

  return parcelas;
}

// ============================================================
// HELPERS DE DATA — mesma convenção de timezone-safety de parcelas.ts
// (Pitfall 6/7): só `Date.UTC` na entrada e getters `getUTC*` na saída,
// NUNCA `new Date(string)` ciente de timezone local.
// ============================================================

/** "YYYY-MM-DD" (ou "YYYY-MM") → "YYYY-MM-01". */
export function mesDaData(data: string): string {
  const [ano, mes] = data.split("-");
  return `${ano}-${mes}-01`;
}

/** Dia do mês de uma "YYYY-MM-DD". Retorna 1 quando a string não tem dia. */
function diaDaData(data: string): number {
  const partes = data.split("-");
  return partes.length >= 3 ? Number(partes[2]) : 1;
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Dia de vencimento ancorado, com clamp a partir do dia ORIGINAL — mesma
 * regra (e mesmo motivo) de `dataVencimentoAncorada` em parcelas.ts: o clamp
 * de um mês curto nunca contamina o mês seguinte. */
function dataVencimentoAncorada(anoMes: string, diaAncora: number): string {
  const [anoStr, mesStr] = anoMes.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const dia = Math.min(diaAncora, ultimoDiaDoMes(ano, mes));
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function proximoMes(anoMes: string): string {
  const [anoStr, mesStr] = anoMes.split("-");
  const data = new Date(Date.UTC(Number(anoStr), Number(mesStr), 1));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Arredonda para 2 casas sem depender de decimal.js (módulo puro, zero
 * imports). Usado só na DISTRIBUIÇÃO de parcelas; o arredondamento de
 * comissão continua centralizado em domain/comissao/money.ts (COMIS-03). */
function arredondarCentavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
