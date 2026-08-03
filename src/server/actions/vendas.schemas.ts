import { z } from "zod";

import { validarEntradaMinima } from "@/domain/vendas/componentes";
import {
  componenteSchema,
  resolverComponentes,
} from "@/server/actions/componentes.schemas";

// Schema de validação da venda, isolado (sem "use server") pelo mesmo motivo
// de produtos.schemas.ts/planos-comissao.schemas.ts: um arquivo "use server"
// só pode exportar funções async. Este arquivo é a fonte única de validação
// do formulário único de venda (VENDA-01).
//
// Dinheiro trafega como number puro (nunca formatado) — a conversão para
// Decimal do Prisma acontece na borda do repo. Datas trafegam como string
// "YYYY-MM-DD" (Pitfall 6): nunca fazemos round-trip por `new Date(string)`
// ciente de timezone local.
//
// Os literais de `plataforma`/`tipoPagamento` abaixo são os valores EXATOS
// dos enums Plataforma/TipoPagamento em prisma/schema.prisma — mantidos como
// string literals (não importados de @prisma/client) para este arquivo
// continuar utilizável em qualquer camada sem depender do client gerado.

const dataSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD");

const mesReferenciaSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-01$/,
    "mesReferencia deve ser o primeiro dia do mês (YYYY-MM-01)",
  );

// linkCrm (v1.1): texto livre (não estritamente uma URL — o closer pode
// colar o "nome do card"/ID do CRM), obrigatório apenas quando `parsed` via
// vendaSchemaParaCloser (a variante usada quando quem cria é um CLOSER,
// VENDA-11/12). Vendas criadas por ADMIN continuam com linkCrm opcional.
const linkCrmSchema = z.string().trim().optional().nullable();

export const vendaSchema = z
  .object({
    dataVenda: dataSchema,
    alunoNome: z.string().trim().min(1, "Nome do aluno é obrigatório"),
    pagadorNome: z.string().trim().min(1, "Nome do pagador é obrigatório"),
    plataforma: z.enum(["ASAAS", "PAGARME", "INTER", "GURU", "OUTRO"]),
    produtoId: z.string().min(1, "Produto é obrigatório"),
    tipoPagamento: z.enum(["A_VISTA", "MENSALISTA"]),
    valorTotal: z.number().min(0, "Valor total não pode ser negativo"),
    entrada: z.number().min(0, "Entrada não pode ser negativa").default(0),
    valorMensalidade: z
      .number()
      .min(0, "Valor da mensalidade não pode ser negativo")
      .default(0),
    numeroParcelas: z
      .number()
      .int("Número de parcelas deve ser inteiro")
      .min(1, "Número de parcelas deve ser ao menos 1")
      .default(1),
    diaVencimento: z
      .number()
      .int("Dia de vencimento deve ser inteiro")
      .min(1, "Dia de vencimento deve estar entre 1 e 31")
      .max(31, "Dia de vencimento deve estar entre 1 e 31"),
    mesReferencia: mesReferenciaSchema,
    closerId: z.string().min(1, "Closer é obrigatório"),
    sdrId: z.string().optional().nullable(),
    observacao: z.string().optional(),
    linkCrm: linkCrmSchema,
    // ---- Fase 11: plano de pagamento estruturado (PGMT-01) ----
    // OPCIONAL de propósito, e vai continuar opcional até a UI de componentes
    // substituir o formulário escalar. Enquanto for omitido, a venda usa o
    // caminho do v1 (entrada/valorMensalidade/numeroParcelas) e nasce sem
    // componentes — exatamente como as 261 vendas históricas, que o backfill
    // converte depois. Isso mantém os scripts, testes e o importador da Fase
    // 10 funcionando sem alteração.
    componentes: z.array(componenteSchema).max(20).optional(),
  })
  .refine(
    (data) =>
      data.tipoPagamento !== "MENSALISTA" ||
      (data.valorMensalidade > 0 && data.numeroParcelas >= 1),
    {
      message:
        "Venda mensalista exige valorMensalidade maior que zero e ao menos 1 parcela",
      path: ["valorMensalidade"],
    },
  )
  .refine((data) => data.tipoPagamento !== "A_VISTA" || data.valorTotal > 0, {
    message: "Venda à vista exige valorTotal maior que zero",
    path: ["valorTotal"],
  })
  // PGMT-05: política de 50% de entrada mínima, confirmada com a gestão em
  // 2026-08-02. Só é aplicada quando a venda vem COM componentes — vendas
  // pelo caminho escalar do v1 não têm como declarar o que é entrada
  // garantida, e o histórico anterior à política precisa continuar
  // representável (PGMT-07).
  .check((ctx) => {
    const componentes = ctx.value.componentes;
    if (!componentes || componentes.length === 0) return;

    const resultado = validarEntradaMinima(resolverComponentes(componentes));
    if (!resultado.valido) {
      ctx.issues.push({
        code: "custom",
        message: resultado.motivo,
        path: ["componentes"],
        input: ctx.value,
      });
    }
  })
  // Coerência entre os dois mundos enquanto ambos coexistem: se a venda
  // declara componentes, a soma deles é o TCV. Divergência aqui quase sempre
  // é erro de digitação — e sem esta trava o dashboard mostraria um TCV e o
  // valor presente sairia de outra base.
  .check((ctx) => {
    const componentes = ctx.value.componentes;
    if (!componentes || componentes.length === 0) return;

    const somaComponentes = componentes.reduce((total, c) => total + c.valor, 0);
    // Tolerância de 1 centavo para arredondamento de divisão.
    if (Math.abs(somaComponentes - ctx.value.valorTotal) > 0.01) {
      ctx.issues.push({
        code: "custom",
        message:
          `A soma dos componentes (${somaComponentes.toFixed(2)}) precisa ser igual ` +
          `ao valor total da venda (${ctx.value.valorTotal.toFixed(2)}).`,
        path: ["componentes"],
        input: ctx.value,
      });
    }
  });

export type VendaInput = z.infer<typeof vendaSchema>;

// Variante usada quando quem está criando a venda é um CLOSER (VENDA-11/12):
// mesmas regras de vendaSchema + linkCrm OBRIGATÓRIO (o closer precisa
// linkar o card do CRM para o ADMIN conseguir conferir antes de aprovar).
// Vendas criadas por ADMIN continuam usando vendaSchema (linkCrm opcional).
export const vendaSchemaParaCloser = vendaSchema.check((ctx) => {
  const linkCrm = ctx.value.linkCrm;
  if (!linkCrm || linkCrm.trim().length === 0) {
    ctx.issues.push({
      code: "custom",
      message: "Link do CRM é obrigatório quando a venda é criada por um closer",
      path: ["linkCrm"],
      input: ctx.value,
    });
  }
});
