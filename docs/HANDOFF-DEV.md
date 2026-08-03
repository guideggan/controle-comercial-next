# Handoff — Controle Comercial NEXT

> Escrito em 02/08/2026, para quem vai assumir o desenvolvimento.
> Leia junto com `docs/APURACAO-COMERCIAL-NEXT.md` (as regras de negócio) e
> `.planning/ROADMAP.md` (o que já foi feito e o que vem).

---

## 1. O que é este sistema, em um parágrafo

Substitui uma planilha de Google Sheets (`Comissões_Vendas - NEXT`) que hoje controla
vendas, carteira de mensalistas e comissões da Next Ecommerce. O valor central é: o
gestor cadastra uma venda **uma vez** e o sistema faz todo o cálculo; cada colaborador
vê sozinho quanto falta para a meta e quanto vai receber. O v1 está completo e em
produção (47/47 requisitos, 10 fases). O v2 começou hoje.

**Stack:** Next.js 16 (App Router, RSC + Server Actions) · React 19 · Prisma 6.19.3 ·
Postgres (Neon) · Better Auth 1.6.23 · Tailwind 4 + shadcn/ui (style base-nova, que usa
**Base UI**, não Radix) · Vitest · Deploy no Render.

**Estado da build:** `tsc` limpo, 223 testes passando, `next build` limpo.

---

## 2. Arquitetura — as 4 camadas e a regra de ouro de cada uma

```
src/domain/**          PURO. Zero imports de framework. Sem server-only, sem
                       @prisma/client, sem next. Só funções e tipos. É onde
                       vive toda regra de cálculo, e é 100% testável isolado.

src/server/repositories/**   Acesso a dados. Sem authz, sem regra de negócio.
                             Recebe `tx` quando precisa compor transação.

src/server/services/**       Orquestra domínio + repos + transação + auditoria.
                             NÃO faz authz.

src/server/actions/**        "use server". É AQUI que a autorização acontece
                             (requireRole/requireUser/requireSelfOrAdmin),
                             sempre na PRIMEIRA linha, antes de qualquer leitura.
```

**Anti-pattern nº 1 do projeto:** recalcular comissão na leitura. A comissão é
calculada uma vez e gravada como snapshot imutável (`ComissaoApurada`, com
`inputSnapshot` JSONB para replay). Painéis e dashboards **leem** o snapshot, nunca
recalculam.

**Pitfalls que o código inteiro respeita — não quebre:**

| # | Regra | Por quê |
|---|---|---|
| 1 | Dinheiro é `Decimal(14,2)` no banco; nunca float na coluna | precisão |
| 2 | Competência (`mesReferencia`) é campo próprio, nunca derivado no read | um pagamento pode ter competência diferente da data |
| 6 | Datas DATE são string `"YYYY-MM-DD"`; conversão só via `Date.UTC` + `getUTC*`. **Nunca `new Date(string)`** | `new Date("2026-07-01")` pode virar 30/06 dependendo do fuso |
| 7 | Dia de vencimento é ancorado no dia ORIGINAL, com clamp por mês | senão fevereiro empurra todo o resto do ano para o dia 28 |
| 10 | `requireRole` antes de qualquer query numa action/route | IDOR |

Há um bug conhecido e recorrente do Prisma 6.19.3: ele **rejeita string `"YYYY-MM-DD"`
pura** em coluna `@db.Date`. Por isso todo repo tem um helper `paraDataUTC` local. Se
criar um repo novo, copie o helper.

---

## 3. O que mudou hoje (02/08/2026) — Fase 11

### 3.1 A regra de negócio que motivou tudo

A gestão mede a meta em **valor presente**, não em caixa. O sistema até hoje só sabia
calcular caixa. A diferença em julho/2026 foi **R$ 604.833 (valor presente) contra
~R$ 159.000 (caixa)** — 4x.

A regra, confirmada com a gestão hoje:

| Forma de pagamento | Conta no mês | Comissão do closer |
|---|---|---|
| PIX / sinal | valor cheio | sobre o valor cheio, no mês |
| Cartão parcelado (12x aprovado de uma vez) | valor cheio | sobre o valor cheio, no mês |
| Boleto parcelado | só o boleto pago | só sobre o boleto pago |
| Recorrência / assinatura | só a parcela paga | só sobre a parcela paga |

A linha de corte é **"a Next já garantiu esse dinheiro ou o cliente ainda pode não
pagar?"**. Cartão parcelado em transação única está garantido (a operadora aprovou
tudo); assinatura recorrente não (o cliente cancela quando quiser). **Cartão aparece
dos dois lados** — não é o meio de pagamento que decide.

No código isso é um booleano por componente: `contaCheioNoMes`.

> As "4 ressalvas" da §2 do documento de apuração **não viraram 4 `if`s**. São
> consequência de uma fórmula só. Se alguma delas voltar como caso especial no código,
> é sinal de que a regra mudou — não de que a fórmula está incompleta.

```
valor presente do mês = Σ componentes que contam cheio, datados no mês
                      + Σ parcelas PAGAS no mês vindas dos demais componentes
```

**Política comercial nova:** toda venda exige no mínimo **50% de entrada**. Não existe
mais venda 100% recorrência. Vendas históricas que violam isso (Vanessa Militani,
julho/2026) continuam válidas — a trava vale só para cadastro novo.

### 3.2 Arquivos criados

| Arquivo | O que faz |
|---|---|
| `src/domain/vendas/componentes.ts` | tipos, regra `contaCheioNoMes`, validação dos 50%, cronograma a partir de componentes |
| `src/domain/vendas/valor-presente.ts` | TCV / valor presente / caixa de uma competência |
| `src/domain/vendas/componentes.test.ts` | 20 testes |
| `src/domain/vendas/valor-presente.test.ts` | 15 testes, **incluindo os 6 casos reais de julho/2026** |
| `src/server/actions/componentes.schemas.ts` | Zod + rótulos e explicações para a UI |
| `src/server/repositories/componente.repo.ts` | CRUD dos componentes + query de faturamento |
| `src/server/services/faturamento.service.ts` | fachada de leitura dos três números |
| `scripts/backfill-componentes.ts` | conversão do histórico (dry-run + `--apply`) |
| `prisma/migrations/20260802000000_...` | migração (**já aplicada no Neon**) |

Os 6 casos de julho estão em `valor-presente.test.ts` como fixture. **Se você mexer no
cálculo, esses testes são o critério de aceite** — eles vêm de uma apuração manual
conferida contra o grupo de WhatsApp.

### 3.3 Modelo de dados novo

```
Venda 1──N ComponentePagamento 1──N Parcela
```

`ComponentePagamento`: `forma`, `contaCheioNoMes`, `valor`, `parcelas`, `dataPrevista`,
`mesPrevisto`, `descricao`, `ordem`.

Uma venda como a da Karen (72k PIX + 72k em 12x no cartão) agora são dois componentes.
A Rafaela (5k sinal + 25k em 03/08 + 30k em 6x), três — cada um com sua data, que é o
que faz os 25k caírem em agosto e não em julho.

**Decisão importante — coexistência temporária:** os campos escalares do v1
(`Venda.entrada`, `valorMensalidade`, `numeroParcelas`) **não foram removidos**. 261
vendas históricas dependem deles. `criarVenda` tem dois caminhos:

- **com** `componentes` no input → caminho novo (`gerarCronogramaDeComponentes`)
- **sem** → caminho do v1, preservado byte a byte

Isso mantém o importador da Fase 10, os scripts e os testes funcionando. Quando a UI de
componentes existir e o backfill tiver rodado, o caminho velho pode morrer.

**Decisão de escopo:** um componente que conta cheio gera **1 parcela** com o valor
cheio, igual ao v1 fazia com "À vista". O cartão 12x **não** é decomposto em 12 parcelas
de caixa nesta fase — isso mudaria `recebidoNoMes` e, com ele, a comissão de todo mundo,
antes de a Fase 13 trocar a base de comissão. A decomposição real entra na Fase 15, com
o extrato do Asaas.

---

## 4. Espaço reservado para as duas integrações

Nenhuma está implementada. O schema já tem o lugar delas, para não exigir uma segunda
migração destrutiva depois.

### Asaas (financeiro)

| Onde | Campo | Para quê |
|---|---|---|
| `Parcela` | `gatewayTransactionId` **@unique** | conciliar por ID, nunca por nome de aluno |
| `Parcela` | `gatewaySincronizadoEm` | quando veio do gateway |
| `Parcela` / `Venda` | `origem` (`MANUAL`/`ASAAS`/`GHL`/`IMPORTACAO`) | distinguir conciliado de digitado |
| `ComponentePagamento` | `gatewayChargeId` **@unique** | a cobrança/assinatura (`pay_xxx`/`sub_xxx`) que representa o componente |
| `SincronizacaoIntegracao` | tabela nova | trilha de cada sync: lidos, conciliados, divergências, relatório JSONB |

O `@unique` no `gatewayTransactionId` torna a conciliação **idempotente por
construção** — rodar o import duas vezes não duplica recebimento. (Postgres permite
múltiplos NULLs em coluna UNIQUE, então as parcelas manuais não colidem.)

### GHL (CRM)

| Onde | Campo | Para quê |
|---|---|---|
| `Venda` | `ghlOpportunityId` **@unique**, `ghlContactId` | oportunidade ganha → venda |
| `Colaborador` | `ghlUserId` **@unique** | ligar usuário do CRM à pessoa daqui |
| `Agendamento` | `ghlAppointmentId` **@unique**, `ghlContactId`, `ghlCalendarId` | agendadas/realizadas |
| `CalendarioGhl` | tabela nova | quais calendários contam como pré-venda |

**Regras do GHL que já estão levantadas** (§8 do documento de apuração — leia antes de
implementar, elas não são óbvias):

- **Agendada** = 1x por lead, no dia da criação, **deduplicada por `contactId`**.
  Reagendamento não reconta. (Por isso `ghlContactId` é indexado.)
- **Realizada** = `appointmentStatus == "showed"`, no dia da call.
- **Atribuição da pessoa** = `createdBy.userId`, **não** `assignedUserId` (esse é o
  closer dono do calendário).
- **D&F e Pós-Vendas nunca contam** como agendamento de pré-venda. É para isso que
  serve `CalendarioGhl.apuravel = false`.
- Filtrar oportunidade por **`Data Fechamento`** (custom field), nunca por
  `lastStatusChangeAt`.
- Tags de canal são reajustadas ao longo do mês — reextrair um mês passado dá números
  diferentes. **Decidir se o número apurado congela no fechamento.**

Os IDs reais de calendário e de custom field estão na §8 do documento de apuração.

---

## 5. Bugs e inconsistências encontrados

Ordenados por impacto. Todos verificados contra o banco real de produção hoje.

### 🔴 B1 — 16 vendas com uma parcela a mais do que o contrato

**R$ 44.349,99 em parcelas que não deveriam existir.**

O importador da Fase 10 tratou a primeira mensalidade como se fosse "entrada" **e**
manteve as 12 mensalidades — gerando 13 parcelas.

```
Victor Xavier:    TCV R$ 15.000 = 12 × R$ 1.250, mas tem 13 parcelas
Fabiane Reusing:  TCV R$ 36.000 = 12 × R$ 3.000, mas tem 13 parcelas
Thais Medeiros:   TCV R$ 36.000 = 12 × R$ 3.000, mas tem 13 parcelas
```

Identificação: `MENSALISTA` onde `entrada == valorMensalidade` e
`entrada + mensalidade × parcelas == TCV + mensalidade`.

**Nenhuma dessas parcelas extras está paga ainda** — então não houve comissão indevida
até agora. Vira dinheiro errado no dia em que alguém marcar uma delas como paga.
Corrigir antes de a carteira avançar.

### 🔴 B2 — O extrato de comissão não bate com a base calculada

Viola COMIS-07 ("o extrato mostra linha a linha COMO o valor foi calculado").

- `apuracao.service.ts` → `valorRecebidoPorPapel()` usa **só um** dos mapas: `porCloser`
  se a pessoa é CLOSER, `porSdr` se é SDR/SS.
- `apuracao.service.ts` → `getExtrato()` filtra
  `venda.closerId === id **||** venda.sdrId === id` — os **dois** lados.

Para quem aparece nos dois papéis, o extrato lista linhas que não entraram no
`valorBase`. **Duas pessoas estão nessa situação hoje: Yuri e KADU** (ambos cadastrados
como CLOSER, mas também aparecem como SDR em vendas).

Correção: `getExtrato` precisa filtrar pelo mesmo critério de papel que a base usa.

### 🟠 B3 — 73 vendas (28%) com `valorTotal` incoerente

`entrada + valorMensalidade × numeroParcelas ≠ valorTotal`. Classificação:

| Padrão | Qtd | Exemplo |
|---|---|---|
| Diferença de centavos (arredondamento de 12x) | 11 | R$ 0,08 |
| Exatamente uma mensalidade a mais | 20 | é o B1 |
| Divergência grande | 42 | Cai Xing: R$ 2.750 vs R$ 36.000 |

Vem da planilha de origem, não do código. **É o que bloqueia o backfill** (ver §6).

### 🟠 B4 — Alunos duplicados por grafia (problema #7 da planilha, replicado)

260 vendas, 251 nomes distintos, **7 grupos que são provavelmente a mesma pessoa**:

```
Leticia A M dos Santos | Leticia Amaro Morreira dos Santos
Angélica Ramos | Angelica Motta | Angelica Marinho
Patrícia da Silva Branco | Patrícia Rodrigues Virtual | Patricia Brasil | Patricia | Patrícia Branco
Ana Paula | Ana Paula dos Santos
```

`Venda.alunoNome` é `String` livre. É exatamente o problema que o documento de apuração
lista como requisito implícito. Resolvido pela **Fase 14** (Cliente com ID).

### 🟡 B5 — `SessionUser.colaboradorId` mente sobre a nullabilidade

`src/server/auth/session.ts` faz:

```ts
type SessionUser = { role: Papel; colaboradorId: string };
return session.user as typeof session.user & SessionUser;
```

Mas `User.colaboradorId` é `String?` no banco — um ADMIN pode não ter colaborador
vinculado. O cast força `string`, então o TypeScript não avisa em
`aprovarVenda(id, user.colaboradorId)`. Em runtime vira `undefined`, e o Prisma trata
`undefined` como "não altere o campo" — falha silenciosa em vez de erro.

Correção: tipar como `colaboradorId: string | null` e tratar nos pontos de uso.

### 🟡 B6 — `requireRole` lança erro genérico

`throw new Error("Forbidden: insufficient role")` vira uma página de erro 500, não um
"acesso negado". Já registrado como decisão adiada no `STATE.md`, mas continua sendo
uma UX ruim para um caso previsível.

### 🟡 B7 — Middleware cobre só `/painel`

`src/middleware.ts` tem `matcher: ["/painel/:path*"]`, mas existem `/inicio`,
`/comissoes`, `/metas`, `/vendas`, `/agendamentos`, `/colaboradores`, `/produtos`.

**Não é vulnerabilidade** — o guard real é sempre o layout/página server-side, e isso é
deliberado (CVE-2025-29927: middleware não é fronteira de autorização). Mas o redirect
de UX só funciona numa rota.

### 🟡 B8 — Imutabilidade da apuração fechada depende só do service

`upsertApuracao` não filtra `status` no `update`. A trava vive em `existeMesFechado()`,
checado antes, no service. Duas consequências:

- TOCTOU: se alguém fechar o mês entre a checagem e a escrita, a linha fechada é
  sobrescrita.
- `apurarMes` checa **uma vez** e passa `permitirFechado: true` para todos os filhos.

Risco baixo (poucos admins), mas a garantia é mais fraca do que o comentário no schema
sugere. Um `WHERE status = 'ABERTA'` no update fecharia a porta no banco.

### 🟢 B9 — `apurarMes` é N+1

Para cada colaborador ativo, `apurarComissao` chama `recebidoNoMes(mes)`, que consulta
**todas as parcelas pagas do mês**. Com 20 colaboradores, são 20 execuções da mesma
query, mais `getPlanoVigente` + `getColaborador` + eventualmente `getMeta` e
`contarCallsRealizadas`.

O `dashboard.service.ts` já resolveu esse mesmo padrão (busca uma vez e passa um
`contexto`). A apuração não recebeu o mesmo tratamento. Funciona, só é lento.

`getReceitaUltimosMeses` tem o mesmo formato: 6 queries sequenciais de mês inteiro.

### 🟢 B10 — Somas de dinheiro em float fora do motor de comissão

`decimal.js` é usado só em `domain/comissao/money.ts`. As agregações
(`agregarRecebidoNoMes`, `agregarReceitaPorTipo`, e o `valor-presente.ts` que escrevi
hoje) somam `number`. O erro acumulado é da ordem de 1e-10 por operação — invisível
hoje, mas é uma inconsistência de disciplina, e cresce com volume.

### 🟢 B11 — `STATE.md` tem um blocker desatualizado

Diz que `plano-comissao.repo.ts` está quebrado contra o banco real (bug de data da Fase
3). **Já foi corrigido** — o `paraDataUTC` está lá, linhas 21/46/63. Só a anotação
ficou.

---

## 6. O que NÃO fiz, e por quê

### O backfill não foi aplicado

`scripts/backfill-componentes.ts` está pronto e o dry-run rodou:

```
Vendas a converter: 260
Divergências: 73
Forma de pagamento presumida (sem pista no texto): 7
```

**Não apliquei de propósito.** As 73 divergências do B3 precisam de decisão humana:
converter como está grava componentes cujo total não fecha o TCV da venda. Aplicar
dados incoerentes silenciosamente é pior do que não aplicar.

Sugestão de ordem: corrigir o B1 (as 16 parcelas extras) → revisar os 42 casos de
divergência grande com quem conhece as vendas → rodar `--apply`.

O script **nunca cria, apaga ou altera valor de parcela** — só cria componentes e
preenche `parcela.componenteId`. Por construção, nenhuma comissão já apurada pode mudar.

Sobre a forma de pagamento no histórico: o v1 nunca guardou isso estruturado (só o texto
livre de `observacao`, copiado do WhatsApp). O script infere por regex e **marca cada
inferência na `descricao`** do componente. Errar aqui é cosmético: a forma afeta só o
relatório de composição, nunca o valor presente — o que decide é `contaCheioNoMes`, que
vem do bloco (entrada vs mensalidade), não da heurística.

### O formulário de venda com componentes

A UI de cadastro **continua sendo a do v1** (campos escalares). Fiz apenas a exibição
read-only do plano de pagamento no detalhe da venda.

Motivo: é um formulário dinâmico não-trivial (lista de componentes com adicionar/remover,
validação cruzada de 50%, soma que precisa fechar o TCV) e eu não tinha como testar no
browser nesta sessão. O backend está pronto e testado — `criarVenda` já aceita
`componentes` e faz tudo certo. **É o primeiro item da sua fila.**

Note que a validação dos 50% e a de "soma dos componentes = TCV" só disparam quando
`componentes` vem preenchido. Enquanto o formulário não enviar componentes, nenhuma
venda nova é barrada.

---

## 7. Sua fila sugerida

1. **Corrigir B1** (16 parcelas extras) — é dinheiro errado esperando para acontecer.
2. **Corrigir B2** (extrato ≠ base) — correção pequena, afeta duas pessoas reais hoje.
3. **Formulário de venda com componentes** — fecha a Fase 11.
4. **Revisar as 73 divergências + rodar o backfill.**
5. **Fase 12** — os três números no dashboard e meta em valor presente
   (`faturamento.service.ts` já entrega tudo pronto; falta a tela e a meta de empresa).
6. **Fase 13** — comissão sobre valor presente. ⚠️ **Mexe em dinheiro que vai para a mão
   das pessoas.** Exige competência de corte decidida pela gestão e a Fase 11 com o
   valor presente batendo com julho/2026.
7. Fases 14 (Cliente), 15 (Asaas), 16 (GHL). A 16 é independente das outras e pode
   correr em paralelo.

Detalhamento de cada fase (goal, requisitos, critérios de aceite) em
`.planning/ROADMAP.md`, seção v2. Os requisitos com ID estão em
`.planning/REQUIREMENTS.md`, seção v2.

---

## 8. Decisões que ainda dependem da gestão

Não implemente essas sem resposta — chutar aqui custa caro:

1. **A regra do percentual de comissão.** Não foi derivável dos dados. Varia por pessoa?
   Produto? Origem? Faixa de atingimento? O `PlanoComissao` é config-driven (JSONB
   versionado por vigência) e suporta qualquer uma dessas leituras **sem migração** —
   mas não modele como percentual fixo por pessoa antes de confirmar.
2. **O que `OTE` substitui.** O formato `salario_bonus_atingimento` já existe. Falta
   saber se substitui totalmente a comissão por venda ou complementa.
3. **Competência de corte da Fase 13.**
4. **Unificação das duas carteiras** (abas de comissão × abas FINANCEIRO/Guru, com
   alunos e gateways diferentes).
5. **Contratos `0/6` e `0/10`** cuja cobrança nunca começou.

---

## 9. Como rodar

```bash
npm install
cp .env.example .env          # preencher DATABASE_URL e DIRECT_URL (Neon)
npx prisma generate
npx prisma migrate deploy
npm run dev
```

```bash
npm run test:run              # 223 testes
npx tsc --noEmit
npx next build
npx tsx scripts/backfill-componentes.ts          # dry-run
```

**Duas armadilhas do ambiente Windows:**

1. `prisma generate` falha com `EPERM ... query_engine-windows.dll.node` quando o dev
   server está rodando — ele segura o `.dll`. Pare o `next dev` antes de gerar.
2. Scripts `tsx` que importam algo de `src/server/` (que tem `server-only` na cadeia)
   precisam de `--conditions=react-server`, senão o pacote `server-only` lança de
   propósito. Os scripts em `scripts/` importam `@prisma/client` direto justamente para
   evitar isso.

**Banco:** as migrações estão aplicadas no Neon de produção, incluindo a de hoje. A
migração da Fase 11 é 100% aditiva (nenhuma coluna removida, renomeada ou alterada de
tipo; toda coluna nova é nullable ou tem DEFAULT), então o v1 continua rodando sem
alteração de código.

---

## 10. Onde está cada coisa

| Preciso mexer em... | Vá para |
|---|---|
| regra de valor presente | `src/domain/vendas/valor-presente.ts` |
| formas de pagamento / 50% de entrada | `src/domain/vendas/componentes.ts` |
| cronograma de parcelas (v1) | `src/domain/vendas/parcelas.ts` |
| cálculo de comissão | `src/domain/comissao/engine.ts` + `planos/*.ts` |
| "recebido no mês" | `src/domain/recebimentos/agregacao.ts` |
| proração semanal de meta | `src/domain/metas/proracao.ts` |
| apuração / fechar / reabrir mês | `src/server/services/apuracao.service.ts` |
| autorização | `src/server/auth/session.ts` |
| dashboard do gestor | `src/server/services/dashboard.service.ts` + `src/app/(admin)/inicio` |
| importação da planilha | `import/importar-historico.ts` |

**Regras de negócio:** `docs/APURACAO-COMERCIAL-NEXT.md` — 491 linhas, tudo verificado
contra dados reais, com o que ficou incerto marcado como ⚠️. É a fonte de verdade do
domínio. Os números de julho/2026 na §10 são fixture de teste.

**Planilhas e materiais com PII** ficam **fora do repo**, na pasta irmã
`../Controle Comercial NEXT - Dados/`. O `.gitignore` bloqueia `*.xlsx`/`*.xls` — não
traga nada disso para cá.
