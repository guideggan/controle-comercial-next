import { z } from "zod";

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
