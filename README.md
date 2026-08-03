# Controle Comercial NEXT

Sistema interno de controle comercial: cada colaborador acompanha sua meta e
comissão em tempo real; o gestor cadastra uma venda uma única vez e o sistema
calcula tudo automaticamente.

Stack: Next.js 16 (App Router, Turbopack) + Prisma 6 (Postgres) + Better Auth
(login por e-mail/senha, sessão de banco) + Tailwind v4 + shadcn/ui (Base UI).

## Pré-requisitos

- Node.js 20+ e npm
- Um Postgres acessível (local via Docker/instalação nativa, ou uma branch de
  dev do Neon) — versão 16 ou 17, mesma major usada em produção

## Setup de desenvolvimento local

1. Instalar dependências:

   ```bash
   npm install
   ```

2. Copiar `.env.example` para `.env` e preencher:

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL`: connection string do seu Postgres local (ou branch do Neon)
   - `BETTER_AUTH_SECRET`: gerar com `openssl rand -base64 32`
   - `BETTER_AUTH_URL`: `http://localhost:3000` em dev
   - `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`: credenciais do primeiro admin
     (a senha nunca é hardcoded em nenhum script — sempre lida do `.env`)
   - `SEED_ADMIN_NOME`: opcional, default `"Admin"` se omitido

3. Aplicar as migrations:

   ```bash
   npx prisma migrate dev
   ```

4. Rodar o seed do admin inicial (idempotente — seguro rodar mais de uma vez):

   ```bash
   npx prisma db seed
   ```

   Isso cria o Colaborador ADMIN + conta de login vinculada (senha passa pelo
   hashing interno do Better Auth) e, como conveniência de dev, os produtos
   padrão (START, PRO, MASTER, PADRAO, Elite) caso ainda não existam.

5. Subir o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

   Acesse `http://localhost:3000/login` e entre com as credenciais do
   `SEED_ADMIN_*` acima.

### Testes

```bash
npm run test      # watch mode
npm run test:run  # uma execução (CI)
```

## Deploy no Render

O projeto inclui um Blueprint (`render.yaml`) com um Web Service Node + um
Postgres gerenciado.

1. No dashboard do Render, criar um **Blueprint** apontando para este
   repositório — ele lê `render.yaml` e provisiona o Postgres (plano
   `starter`, nunca o plano free — que expira em 30 dias) e o Web Service na
   mesma região.
2. Preencher manualmente no dashboard (aba **Environment** do Web Service) as
   variáveis marcadas `sync: false` no `render.yaml`:
   - `BETTER_AUTH_SECRET` (gerar um valor forte, ex.: `openssl rand -base64 32`)
   - `BETTER_AUTH_URL` (a URL pública do serviço no Render ou domínio customizado)
   - `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NOME` (apenas
     necessárias transitoriamente para o primeiro seed — podem ser removidas
     ou rotacionadas depois)
   - `DATABASE_URL` já vem preenchida automaticamente pelo Render, apontando
     para a conexão **interna** do Postgres (mesma região, rede privada) —
     não é necessário preencher manualmente
3. O **Pre-Deploy Command** (`npx prisma migrate deploy`) roda automaticamente
   em todo deploy, uma única vez, isolado, antes do tráfego novo — nunca no
   comando de start (evita migrations concorrentes se o serviço escalar para
   mais de uma instância).
4. Após o primeiro deploy bem-sucedido, rodar o seed do admin **uma vez**
   (via Shell do Render no serviço, ou um Job manual):

   ```bash
   npx prisma db seed
   ```

   Depois disso, `SEED_ADMIN_PASSWORD` pode ser removida/rotacionada do
   dashboard — o seed é idempotente e não recria o admin se ele já existir.

## Regras do negócio — leia antes de mexer na apuração

[`docs/APURACAO-COMERCIAL-NEXT.md`](docs/APURACAO-COMERCIAL-NEXT.md) é o
documento de referência da apuração comercial real da Next, levantado em
02/08/2026 a partir do fechamento de julho/2026 e **verificado contra dados
reais** (o que é incerto está marcado como ⚠️ INCERTO). É o que este sistema
precisa substituir.

O que ele traz e o sistema tem que honrar:

- a regra de faturamento **TCV × valor presente × caixa** com as 4 ressalvas
  (cartão 12x conta cheio, entrada+recorrência conta só a entrada, pagamento
  datado em outro mês não conta, venda 100% recorrência conta 1 parcela) —
  **a meta mensal é de valor presente**;
- a estrutura da planilha que hoje faz esse trabalho (blocos carteira ×
  vendas novas, dicionário de colunas) e seus 10 problemas conhecidos, que
  são requisitos implícitos;
- o cálculo de comissão (base = valor recebido, só sobre status `Pago`, paga
  no mês seguinte) e os marcadores especiais (`OTE`, `A definir`, …);
- as regras de contagem de pré-vendas e os IDs do GHL usados na apuração;
- o modelo de dados proposto para o hub (seção 9) — em especial o **plano de
  pagamento**, o dado que hoje só existe como texto livre no WhatsApp;
- os **números de julho/2026 (seção 10) como fixture** para validar qualquer
  implementação do cálculo.

## Dados e análises (fora do repo)

Planilhas de origem, relatórios de apuração e arquivos de conferência **não
ficam neste repositório** (contêm PII). Vivem na pasta irmã
`../Controle Comercial NEXT - Dados/` (`planilhas/`, `apuracao/`,
`julho-2026/`) — ver o README de lá. É de onde o importador de histórico lê
sua planilha padrão.

## Estrutura do projeto (resumo)

- `prisma/schema.prisma` — schema (enum `Papel`, tabelas do Better Auth,
  `Colaborador`, `Produto`); convenções de tipos (dinheiro, percentual, datas)
  documentadas no topo do arquivo.
- `prisma/seed.ts` — seed do admin inicial + produtos padrão.
- `src/server/auth/` — instância do Better Auth (`auth.ts`) e o DAL
  server-only de autorização (`session.ts`: `requireUser`/`requireRole`/
  `requireSelfOrAdmin`) — único ponto de controle de "quem acessa o quê".
- `src/server/repositories/` — acesso a dados (sem authz).
- `src/server/actions/` — Server Actions (`"use server"`), cada uma
  protegida por `requireRole`/`requireUser` no início.
- `src/app/(admin)/` — rotas restritas a `ADMIN` (gate no `layout.tsx`).
- `src/app/(colaborador)/` — rotas de qualquer colaborador autenticado.
