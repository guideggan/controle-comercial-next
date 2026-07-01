// Helpers de formatação pt-BR SOMENTE para exibição (PITFALLS.md "R$
// formatting"): dinheiro e percentual nunca circulam formatados pela
// aplicação (banco/Zod/service sempre usam number puro — R$ como decimal,
// percentual como fração 0.03 = 3%); a conversão para string pt-BR acontece
// só na borda de exibição, aqui.

const formatadorBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatarBRL(valor: number): string {
  return formatadorBRL.format(valor);
}

// Recebe a fração (0.0125 = 1,25%) e formata como percentual pt-BR com até 2
// casas decimais, sem casas desnecessárias (0.03 -> "3%", 0.0125 -> "1,25%").
export function formatarPercentual(fracao: number): string {
  const percentual = fracao * 100;
  const comDuasCasas = Math.round(percentual * 100) / 100;
  const texto = comDuasCasas.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${texto}%`;
}
