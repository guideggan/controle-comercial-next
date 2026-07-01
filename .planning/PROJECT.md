# Controle Comercial NEXT

## What This Is

Sistema web (Next.js + Postgres, deploy no Render) para a empresa **NEXT** substituir duas planilhas de controle comercial: **Comissões de Vendas** e **Desempenho do Time**. Ele centraliza o cadastro de vendas, calcula automaticamente a comissão de cada closer e SDR/SS (cada um com seu próprio formato de comissão) e dá a cada colaborador um **painel self-service de acompanhamento de meta**, eliminando a dependência de reuniões com o gestor para saber "quanto falta pra bater a meta".

## Core Value

Cada colaborador consegue ver, sozinho e a qualquer momento, **quanto está distante da própria meta** e **quanto vai receber de comissão** — e o gestor cadastra uma venda uma única vez e o sistema faz todo o cálculo (parcelas, comissões, apuração por mês) automaticamente.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Cadastro de colaboradores com papel (Admin/Gestor, Closer, SDR, SS) e formato de comissão próprio por pessoa
- [ ] Cadastro de uma venda em um único formulário (aluno, pagador, plataforma, produto/tier, tipo de pgto, TCV, entrada, mensalidade, nº de parcelas, vencimento, closer, SDR/SS)
- [ ] Geração automática das parcelas mensais previstas a partir de um cadastro de venda mensalista
- [ ] Marcar cada parcela/entrada como Paga ou Pendente, definindo o valor efetivamente recebido no mês
- [ ] Motor de comissão que apura sobre o VALOR RECEBIDO no mês (entrada + mensalidade + à vista), nunca sobre o TCV, e só quando Pago
- [ ] Motor de comissão suportando 3 formatos por pessoa: % fixo sobre o recebido; progressivo por atingimento de meta; fixo + variável
- [ ] Comissão de SDR/SS calculada por quantidade de calls (agendamentos) realizadas
- [ ] Apuração de comissão separando "mês de referência" (competência) de "mês de pagamento" (paga no mês seguinte)
- [ ] Definição de metas por colaborador e por mês (valor R$ para closer; nº de agendamentos para SDR/SS), com quebra automática em metas semanais proporcionais
- [ ] Painel self-service do colaborador: meta, realizado, meta proporcional acumulada, % esperado vs % atingido, saldo, e comissão prevista do mês
- [ ] Controle de agendamentos do SDR/SS: agendadas x realizadas por dia da semana
- [ ] Dashboard do gestor consolidando por mês: receita (à vista/mensalista), contagem por produto, comissão total por closer e por SDR/SS
- [ ] Login individual: cada colaborador acessa e vê apenas o próprio painel; admin vê tudo e cadastra vendas/metas
- [ ] Importador que carrega o histórico das duas planilhas atuais para o banco

### Out of Scope

- Papéis BDR e Sócio/Parceiro — não priorizados nesta versão (podem entrar depois; existem "VALORES PARCEIRO" e "renovações" nas planilhas mas ficam fora do v1)
- Conciliação financeira detalhada por intermediador (aba FINANCEIRO) — o foco do v1 é comissão + meta, não fechamento contábil
- App mobile nativo — web responsivo atende (colaboradores acessam pelo navegador)
- Integração automática com gateways de pagamento (ASAAS/Pagar.me/Guru) — status de pagamento é marcado manualmente no v1

## Context

**Origem — duas planilhas Excel reais analisadas:**

1. **Comissões_Vendas - NEXT.xlsx** — abas mensais nomeadas "MÊS-REF PGTO MÊS-SEGUINTE" (ex.: "JUNHO PGTO JULHO"). Cada linha = uma parcela/valor recebido em um mês. Colunas: DATA, ALUNO, PAGADOR (nome no banco), COMPROVANTE, PLATAFORMA (ASAAS/Pagar.me/Inter/Guru), PRODUTO/tier (START/PRO/MASTER/PADRÃO-Mentoria/Elite), TIPO DE PGTO (à vista vs mensalista), VALOR TOTAL DA VENDA (TCV), ENTRADA, MENSALIDADE, PARCELA (ex.: 09/12), DIA VENCIMENTO, MÊS DE REFERÊNCIA, OBS, STATUS (Pago/Pendente), CLOSER + % + comissão, SDR + % + comissão, e uma coluna FÓRMULA = valor efetivamente recebido no mês. Rodapé de cada mês consolida receita (à vista/mensalista/total), contagem por produto, comissão por closer e por SDR/SS. Tem aba Dashboard e aba FINANCEIRO (conciliação por intermediador).

2. **Desempenho Time - NEXT.xlsx** — uma aba por pessoa (ex.: Yuri, Paola-Closer, Pedro-Closer, João Pedro-SDR, Bruna-SDR, José-BDR, Time-SS). Blocos semanais por mês com: Data (faixa da semana), Referência (mês), Meta (mensal), Meta Proporcional (acumulada até a semana), Realizado, Percentual atingido, Percentual esperado, Saldo. SDRs medem em nº de agendamentos (ex.: 110/mês) e ainda controlam agendadas x realizadas por dia (segunda a sábado). Closers medem em R$ (ex.: 500.000), separando "À vista" e "Mensalistas", e algumas abas têm tabelas de referência de comissão progressiva (ex.: <70%→0,5% ... 100%→1,25% ... 110%→1,5%) e por tamanho de meta (500K→3% / 300K→2,5%).

**Nuances de negócio confirmadas com o usuário:**
- Comissão incide sobre o valor que ENTRA no mês (entrada paga no mês + mensalidade da parcela + valor à vista), NUNCA sobre o TCV, e só quando status = Pago.
- Cada colaborador tem seu PRÓPRIO formato de comissão — quem entrou há muito tempo manteve o formato antigo. Formatos existentes: % fixo sobre o recebido; progressivo por atingimento de meta; fixo + variável.
- A entrada comissiona igual à mensalidade (ex.: entrada de R$ 72.666 do aluno Matheus/Bianca contabilizada como valor recebido).
- Comissão do SDR/SS é baseada na QUANTIDADE DE CALLS REALIZADAS (não é % sobre a venda) — liga diretamente ao painel de agendadas x realizadas.
- Competência: apura no mês de referência, PAGA ao vendedor no mês seguinte.
- Metas mudam a cada mês e são definidas por pessoa/mês pelo admin; o sistema quebra em metas semanais proporcionais.

## Constraints

- **Tech stack**: Next.js (React, full-stack) + Postgres — escolhido pelo usuário; deploy no Render.
- **Idioma**: Interface e dados em português (Brasil); valores em R$.
- **Autenticação**: login individual com controle de acesso por papel (colaborador vê só o próprio painel; admin vê tudo).
- **Migração**: importar TODO o histórico das duas planilhas existentes para o banco.
- **Motor de comissão**: precisa ser configurável por pessoa (formatos heterogêneos coexistem), não um % global.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js + Postgres no Render | Stack única full-stack, fácil de manter e com a pasta já nomeada "Next"; Render tem Postgres gerenciado | — Pending |
| Comissão configurável por pessoa (3 formatos) | Colaboradores antigos mantêm formatos legados; % único não atende | — Pending |
| Comissão sobre valor recebido no mês, nunca sobre TCV | Regra central do negócio já usada na planilha (coluna FÓRMULA) | — Pending |
| SDR/SS comissiona por calls realizadas | Confirmado pelo usuário; difere do % sobre venda que aparece na planilha antiga | — Pending |
| Cadastro único gera parcelas automaticamente | Reduz digitação e erro; usuário só marca parcela como paga | — Pending |
| Apuração separa mês de referência de mês de pagamento | Refletir o modelo "PGTO mês seguinte" das abas | — Pending |
| Importar histórico completo das 2 planilhas | Não perder base histórica de vendas e metas | — Pending |

---
*Last updated: 2026-07-01 after initialization*
