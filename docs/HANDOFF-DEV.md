# Handoff técnico — Controle Comercial NEXT

> Para quem vai assumir a evolução técnica do app.
> Escrito em 02/08/2026.

**Divisão de responsabilidade, para não haver mal-entendido:** as regras de negócio
(como a comissão é calculada, o que conta como faturamento no mês, quando uma venda é
válida) **não são decisão de engenharia** — elas vêm da gestão comercial e estão
implementadas, comentadas e travadas em testes. Este documento é sobre a **arquitetura,
a performance e a dívida técnica**. Se um teste em `src/domain/**` quebrar, isso é um
sinal de que uma regra de negócio foi alterada — não um teste chato para ajustar. Fale
com o Guilherme antes.

---

## 1. Visão geral

Substitui uma planilha de Google Sheets que controlava vendas, carteira de mensalistas e
comissões. Cadastra-se a venda uma vez; o sistema gera o cronograma de parcelas, apura a
comissão de cada pessoa conforme o plano dela, e alimenta os painéis.

**Stack:** Next.js 16 (App Router, RSC + Server Actions) · React 19 · Prisma 6.19.3 ·
Postgres (Neon) · Better Auth 1.6.23 · Tailwind 4 + shadcn/ui **style base-nova, que usa
Base UI e não Radix** · Vitest · deploy no Render.

**Escala real:** ~20 colaboradores, ~275 vendas, ~1.450 parcelas. É um app de baixo
volume e alta exigência de exatidão — otimize para clareza e correção, não para throughput.

**Estado:** `tsc` limpo · 227 testes passando · `next build` limpo.

---

## 2. Arquitetura — as 4 camadas

```
src/domain/**                PURO. Zero imports de framework: sem server-only, sem
                             @prisma/client, sem next. Só funções e tipos.
                             Toda regra de cálculo vive aqui. 100% testável isolado.

src/server/repositories/**   Acesso a dados. Sem authz, sem regra de negócio.
                             Recebe `tx` quando precisa compor transação.

src/server/services/**       Orquestra domínio + repos + transação + auditoria.
                             NÃO faz authz.

src/server/actions/**        "use server". A autorização acontece AQUI, sempre na
                             primeira linha, antes de qualquer leitura.
```

Essa separação é o que segura o projeto. O domínio puro é a razão de dar para testar
regras financeiras complexas em milissegundos, sem banco e sem mock.

**Anti-pattern nº 1:** recalcular comissão na leitura. A comissão é calculada uma vez e
gravada como snapshot imutável (`ComissaoApurada`, com `inputSnapshot` JSONB para
replay/auditoria). Painéis **leem** o snapshot. Se você vir código recalculando comissão
numa página, é bug.

### Convenções que o código inteiro respeita

| # | Regra | Consequência de quebrar |
|---|---|---|
| 1 | Dinheiro é `Decimal(14,2)`; nunca float na coluna | centavos errados em relatório financeiro |
| 2 | Competência (`mesReferencia`) é campo próprio, nunca derivado no read | um pagamento pode ter competência ≠ da data |
| 6 | Datas DATE são string `"YYYY-MM-DD"`; converte só via `Date.UTC` + `getUTC*`. **Nunca `new Date(string)`** | `new Date("2026-07-01")` vira 30/06 em fuso negativo |
| 7 | Dia de vencimento ancorado no dia ORIGINAL, com clamp por mês | fevereiro empurraria todo o resto do ano para o dia 28 |
| 10 | `requireRole` antes de qualquer query em action/route handler | IDOR |

**Armadilha do Prisma 6.19.3:** ele rejeita string `"YYYY-MM-DD"` pura em coluna
`@db.Date` (erro "premature end of input"). Por isso todo repo tem um helper
`paraDataUTC` local. Criou repo novo? Copie o helper.

---

## 3. O que mudou em 02/08/2026 (Fase 11)

A gestão mede a meta em **valor presente**; o sistema só sabia calcular caixa. Em
julho/2026 a diferença foi de ~4x. A Fase 11 introduziu o plano de pagamento estruturado
e o cálculo de valor presente.

**Modelo novo:** `Venda 1──N ComponentePagamento 1──N Parcela`. Cada componente tem
forma, valor, nº de parcelas, data própria e uma explicação em texto. Uma venda paga
metade em PIX e metade em cartão são dois componentes; um pagamento combinado para o mês
seguinte tem data própria e cai no mês dele.

**Arquivos:** `src/domain/vendas/componentes.ts` e `valor-presente.ts` (domínio puro,
35 testes) · `componentes.schemas.ts` · `componente.repo.ts` · `faturamento.service.ts` ·
`componentes-pagamento-field.tsx` (UI) · `scripts/backfill-componentes.ts`.

### Duas decisões de arquitetura que você precisa conhecer

**(a) Coexistência temporária de dois caminhos.** Os campos escalares do v1
(`Venda.entrada`, `valorMensalidade`, `numeroParcelas`) **não foram removidos** — 260
vendas históricas dependem deles. `criarVenda` tem dois caminhos: com `componentes` no
input usa o novo; sem, usa o do v1 preservado byte a byte. Isso mantém o importador da
Fase 10, os scripts e os testes funcionando.

> Quando o backfill tiver convertido o histórico e o formulário sempre enviar
> componentes, o caminho do v1 pode ser deletado. **Não delete antes disso.**

**(b) Componente que conta cheio gera 1 parcela, não N.** Um cartão em 12x vira uma
parcela com o valor cheio, não doze de 1/12. Decompor mudaria `recebidoNoMes` e, com ele,
a comissão de todo mundo — antes de a Fase 13 trocar a base de comissão. A decomposição
real entra na Fase 15, quando o extrato do Asaas for a fonte dessas parcelas.

---

## 4. Espaço reservado para Asaas e GHL

Nenhuma das duas está implementada; o schema já tem o lugar delas, para a integração não
exigir uma segunda migração destrutiva.

**Asaas / gateways:** `Parcela.gatewayTransactionId` **@unique**,
`Parcela.gatewaySincronizadoEm`, `ComponentePagamento.gatewayChargeId` **@unique**,
enum `OrigemRegistro` (`MANUAL`/`ASAAS`/`GHL`/`IMPORTACAO`) em Venda/Parcela/Agendamento,
e a tabela `SincronizacaoIntegracao` (lidos, conciliados, divergências, relatório JSONB).

Os `@unique` são o que torna a conciliação **idempotente por construção** — rodar o
import duas vezes não duplica recebimento. Postgres permite múltiplos NULLs em coluna
UNIQUE, então os registros manuais não colidem.

**GHL:** `Venda.ghlOpportunityId` **@unique** e `ghlContactId`, `Colaborador.ghlUserId`
**@unique**, `Agendamento.ghlAppointmentId` **@unique** / `ghlContactId` /
`ghlCalendarId`, e a tabela `CalendarioGhl` (quais calendários contam como pré-venda).

> As **regras** de contagem do GHL (dedup por contato, qual campo de atribuição usar,
> quais calendários excluir) estão na §8 de `docs/APURACAO-COMERCIAL-NEXT.md`. Elas não
> são óbvias e não são negociáveis — leia antes de implementar, e confirme com o
> Guilherme se algo parecer ambíguo.

---

## 5. Dívida técnica e bugs

Tudo abaixo foi verificado contra o banco real. Os dois primeiros já estão corrigidos
nesta entrega.

### ✅ Corrigido — extrato de comissão não batia com a base

`getExtrato` filtrava `closerId === id || sdrId === id` (os dois lados), enquanto a base
(`valorRecebidoPorPapel`) usa só um dos mapas conforme o papel. Quem atua nos dois papéis
via um extrato cuja soma não fechava com o valor apurado. Corrigido em
`apuracao.service.ts`, com 4 testes de regressão.

### ✅ Script pronto — 16 vendas com uma parcela a mais

A importação da Fase 10 tratou a 1ª mensalidade de alguns contratos como "entrada"
separada **e** manteve as 12 mensalidades: 13 parcelas num contrato de 12. São
R$ 44.349,99 em parcelas que não deveriam existir; **nenhuma está paga**, então não houve
pagamento indevido.

`scripts/corrigir-parcela-extra.ts` remove a excedente, decrementa `numeroParcelas` e
audita. Nunca toca parcela paga nem venda de mês fechado.

### 🟠 Dado inconsistente vindo da planilha — 73 vendas (28%)

`entrada + valorMensalidade × numeroParcelas ≠ valorTotal`:

| Padrão | Qtd |
|---|---|
| Diferença de centavos (arredondamento de 12x) | 11 |
| Exatamente uma mensalidade a mais | 20 (é o caso acima) |
| Divergência grande, sem padrão | 42 |

**É o que bloqueia a aplicação do backfill de componentes.** Os 42 casos grandes precisam
de conferência com quem conhece as vendas — não são resolvíveis por código.

### 🟠 Aluno é texto livre, sem ID

`Venda.alunoNome: String`. 260 vendas, 251 nomes distintos, e **7 grupos que são
provavelmente a mesma pessoa** com grafias diferentes (incluindo erros de digitação e
nomes parciais). Impede conciliar por identidade e liga vendas do mesmo cliente. Resolvido
pela Fase 14 (`Cliente` com ID) — que é pré-requisito da conciliação com o Asaas.

### 🟡 `SessionUser.colaboradorId` mente sobre a nullabilidade

```ts
type SessionUser = { role: Papel; colaboradorId: string };
return session.user as typeof session.user & SessionUser;
```

`User.colaboradorId` é `String?` no banco — um ADMIN pode não ter colaborador vinculado.
O cast força `string`, então o TS não avisa em `aprovarVenda(id, user.colaboradorId)`. Em
runtime vira `undefined`, e o Prisma trata `undefined` como "não altere o campo" — falha
silenciosa. Tipar como `string | null` e tratar nos pontos de uso.

### 🟡 `requireRole` lança erro genérico

`throw new Error("Forbidden: insufficient role")` vira página de erro 500, não um "acesso
negado". Caso previsível merecendo tratamento melhor.

### 🟡 Middleware cobre só `/painel`

`matcher: ["/painel/:path*"]`, mas existem `/inicio`, `/comissoes`, `/metas`, `/vendas`,
`/agendamentos`, `/colaboradores`, `/produtos`.

**Não é vulnerabilidade** — o guard real é sempre o layout/página server-side, e isso é
deliberado (CVE-2025-29927: middleware não é fronteira de autorização). Mas o redirect de
UX só funciona numa rota.

### 🟡 Imutabilidade da apuração fechada depende só do service

`upsertApuracao` não filtra `status` no `update`; a trava vive em `existeMesFechado()`,
checado antes. TOCTOU: fechar o mês entre a checagem e a escrita sobrescreve a linha
fechada. Um `WHERE status = 'ABERTA'` fecharia a porta no banco. Risco baixo (poucos
admins), mas a garantia é mais fraca do que o comentário no schema sugere.

### 🟢 Performance — `apurarMes` é N+1

Para **cada** colaborador ativo, `apurarComissao` chama `recebidoNoMes(mes)`, que
consulta **todas as parcelas pagas do mês**. Com 20 colaboradores, são 20 execuções da
mesma query, mais `getPlanoVigente` + `getColaborador` + eventualmente `getMeta` e
`contarCallsRealizadas`.

O `dashboard.service.ts` **já resolveu esse mesmo padrão** — busca uma vez e passa um
objeto `contexto` para `getAcompanhamentoMeta` (veja `getAtingimentoMetaTodos`). A
apuração não recebeu o mesmo tratamento. É o refactor de performance mais óbvio do
projeto, e há um padrão pronto para copiar.

`getReceitaUltimosMeses` tem o mesmo formato: 6 queries sequenciais de mês inteiro para
montar o gráfico.

### 🟢 Somas de dinheiro em float fora do motor de comissão

`decimal.js` é usado só em `domain/comissao/money.ts` (arredondamento único, ROUND_HALF_UP).
As agregações (`agregarRecebidoNoMes`, `agregarReceitaPorTipo`, `valor-presente.ts`) somam
`number`. Erro da ordem de 1e-10 por operação — invisível hoje, mas é inconsistência de
disciplina e cresce com volume.

### 🟢 `.planning/STATE.md` tinha um blocker já resolvido

Dizia que `plano-comissao.repo.ts` estava quebrado contra o banco (bug de data da Fase 3).
Já corrigido — verificado hoje. A anotação foi atualizada.

---

## 6. O que ainda não foi feito

**O backfill de componentes não foi aplicado.** O script está pronto e o dry-run rodou
(260 vendas a converter). Não apliquei porque as 73 divergências acima precisam de
decisão humana: converter como está gravaria componentes cujo total não fecha o TCV.

O script **nunca cria, apaga ou altera valor de parcela** — só cria componentes e
preenche `parcela.componenteId`. Por construção, nenhuma comissão já apurada pode mudar.

Ordem sugerida: rodar `corrigir-parcela-extra.ts --apply` → conferir os 42 casos grandes
com o Guilherme → `backfill-componentes.ts --apply`.

**Fases 12 a 16** estão especificadas em `.planning/ROADMAP.md` (goal, dependências,
critérios de aceite) e `.planning/REQUIREMENTS.md` (requisitos com ID). A 16 (GHL) é
independente das outras e pode correr em paralelo.

---

## 7. Onde mexer

| Preciso mexer em... | Vá para |
|---|---|
| regra de valor presente | `src/domain/vendas/valor-presente.ts` |
| formas de pagamento / entrada mínima | `src/domain/vendas/componentes.ts` |
| cronograma de parcelas (v1) | `src/domain/vendas/parcelas.ts` |
| cálculo de comissão | `src/domain/comissao/engine.ts` + `planos/*.ts` |
| "recebido no mês" | `src/domain/recebimentos/agregacao.ts` |
| proração semanal de meta | `src/domain/metas/proracao.ts` |
| apuração / fechar / reabrir mês | `src/server/services/apuracao.service.ts` |
| autorização | `src/server/auth/session.ts` |
| dashboard do gestor | `src/server/services/dashboard.service.ts` + `src/app/(admin)/inicio` |
| importação da planilha | `import/importar-historico.ts` |

`docs/APURACAO-COMERCIAL-NEXT.md` é a fonte de verdade do domínio: como a apuração
funciona hoje, as regras confirmadas, e o que ficou incerto (marcado com ⚠️).

---

## 8. Como rodar

```bash
npm install
cp .env.example .env          # DATABASE_URL e DIRECT_URL (Neon) — peça ao Guilherme
npx prisma generate
npx prisma migrate deploy
npm run dev
```

```bash
npm run test:run              # 227 testes
npx tsc --noEmit
npx next build

npx tsx scripts/corrigir-parcela-extra.ts       # dry-run; --apply para gravar
npx tsx scripts/backfill-componentes.ts         # dry-run; --apply para gravar
```

**Duas armadilhas do ambiente Windows:**

1. `prisma generate` falha com `EPERM ... query_engine-windows.dll.node` quando o dev
   server está rodando — ele segura o `.dll`. Pare o `next dev` antes de gerar.
2. Scripts `tsx` que importam algo de `src/server/` (que tem `server-only` na cadeia)
   precisam de `--conditions=react-server`. Os scripts em `scripts/` importam
   `@prisma/client` direto justamente para evitar isso.

**Banco:** todas as migrações estão aplicadas no Neon, incluindo a da Fase 11 — que é
100% aditiva (nenhuma coluna removida, renomeada ou alterada de tipo; toda coluna nova é
nullable ou tem DEFAULT).

**Dados sensíveis:** planilhas e materiais com dados de clientes ficam **fora do repo**.
O `.gitignore` bloqueia `*.xlsx`/`*.xls` e `import/.output/`. Não traga nada disso para
cá, e não coloque nomes de clientes reais em código, comentário ou documentação.
