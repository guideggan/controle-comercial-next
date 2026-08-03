# Requirements: Controle Comercial NEXT

**Defined:** 2026-07-01
**Core Value:** Cada colaborador vê sozinho quanto falta pra sua meta e quanto vai receber de comissão; o gestor cadastra a venda uma vez e o sistema faz todo o cálculo automaticamente.

## v1 Requirements

Requisitos da primeira entrega. Cada um mapeia para uma fase do roadmap.

### Autenticação e Acesso (AUTH)

- [x] **AUTH-01**: Colaborador faz login com e-mail e senha
- [x] **AUTH-02**: Sessão persiste entre recarregamentos do navegador e carrega papel + colaborador vinculado
- [x] **AUTH-03**: Colaborador (Closer/SDR/SS) só acessa e vê os próprios dados; a restrição é imposta no servidor, não só na interface
- [x] **AUTH-04**: Admin/Gestor acessa todos os dados e todas as telas de cadastro
- [x] **AUTH-05**: Admin pode criar, desativar e redefinir senha de contas de colaboradores

### Colaboradores e Planos de Comissão (COLAB)

- [x] **COLAB-01**: Admin cadastra colaborador com nome, papel (Admin/Gestor, Closer, SDR, SS) e dados de contato/PIX
- [x] **COLAB-02**: Admin define o plano de comissão de cada colaborador, escolhendo o formato: % fixo sobre o recebido
- [x] **COLAB-03**: Admin define plano de comissão no formato progressivo por atingimento de meta (faixas de % conforme % da meta batida)
- [x] **COLAB-04**: Admin define plano de comissão no formato fixo + variável (valor garantido + % por cima)
- [x] **COLAB-05**: Admin define plano de comissão de SDR/SS por quantidade de calls (agendamentos) realizadas
- [x] **COLAB-06**: Plano de comissão é versionado por vigência (início/fim), de forma que mudanças não reescrevem o histórico já apurado
- [x] **COLAB-07**: Admin cadastra e edita produtos/tiers (START/PRO/MASTER/PADRÃO/Elite) usados nas vendas

### Vendas e Parcelas (VENDA)

- [x] **VENDA-01**: Admin cadastra uma venda em um único formulário (data, aluno, pagador, plataforma, produto, tipo de pgto à vista/mensalista, TCV, entrada, valor da mensalidade, nº de parcelas, dia de vencimento, closer, SDR/SS, observação)
- [x] **VENDA-02**: Ao salvar uma venda mensalista, o sistema gera automaticamente as parcelas mensais previstas (entrada + N mensalidades) de forma atômica com a venda
- [x] **VENDA-03**: O dia de vencimento é ancorado, de modo que parcelas em meses curtos não escorregam permanentemente (31→30→29)
- [x] **VENDA-04**: Admin edita/corrige uma venda e suas parcelas, com as devidas travas quando um mês já foi fechado
- [x] **VENDA-05**: Admin lista e busca vendas por aluno, closer, produto, status e mês de referência

### Recebimentos (PGTO)

- [x] **PGTO-01**: Admin marca cada parcela/entrada como Paga ou Pendente, informando valor recebido e data do pagamento
- [x] **PGTO-02**: O sistema calcula o "valor recebido no mês" somando entrada + mensalidades + vendas à vista efetivamente pagas naquele mês, sem dupla contagem
- [x] **PGTO-03**: Somente valores com status Pago entram na base de comissão; pendentes contam como zero

### Motor de Comissão e Apuração (COMIS)

- [x] **COMIS-01**: A comissão incide sobre o valor recebido no mês, nunca sobre o TCV
- [x] **COMIS-02**: O motor calcula a comissão de cada colaborador conforme o formato do plano dele (fixo, progressivo, fixo+variável, por calls)
- [x] **COMIS-03**: Valores monetários usam decimal exato e o arredondamento ocorre uma única vez no total (não por faixa/parcela)
- [x] **COMIS-04**: A apuração separa mês de referência (competência) do mês de pagamento (mês seguinte), ambos gravados explicitamente
- [x] **COMIS-05**: A apuração é gravada como snapshot imutável por pessoa/mês; os painéis leem o snapshot e não recalculam ao vivo
- [x] **COMIS-06**: Admin pode "fechar/travar" a apuração de um mês, impedindo alterações retroativas silenciosas
- [x] **COMIS-07**: Extrato de comissão por pessoa/mês mostra, linha a linha, como o valor foi calculado (vendas, valores recebidos, % aplicado, total)

### Metas e Proração Semanal (META)

- [x] **META-01**: Admin define a meta de cada colaborador por mês (valor em R$ para closer; nº de agendamentos para SDR/SS)
- [x] **META-02**: O sistema quebra a meta mensal em metas semanais proporcionais acumuladas
- [x] **META-03**: Para cada semana o sistema mostra realizado, meta proporcional, % atingido, % esperado e saldo
- [x] **META-04**: O realizado do closer soma vendas à vista + mensalistas recebidos; o do SDR/SS soma agendamentos

### Agendamentos SDR/SS (AGEND)

- [x] **AGEND-01**: SDR/SS registra agendamentos com status (agendado, realizado, no-show, cancelado) por dia da semana
- [x] **AGEND-02**: O total de calls realizadas alimenta tanto a comissão do SDR/SS quanto o painel de meta, a partir de uma única fonte de dados
- [x] **AGEND-03**: Painel de agendadas × realizadas por dia (segunda a sábado) para a semana corrente

### Painel do Colaborador (PAINEL)

- [x] **PAINEL-01**: Colaborador vê o próprio acompanhamento de meta do mês (meta, realizado, meta proporcional, % esperado vs atingido, saldo)
- [x] **PAINEL-02**: Colaborador vê a própria comissão prevista/apurada do mês corrente
- [x] **PAINEL-03**: Colaborador vê o próprio extrato de comissão e histórico de meses anteriores
- [x] **PAINEL-04**: SDR/SS vê o próprio painel de agendadas × realizadas

### Dashboard do Gestor (GESTOR)

- [x] **GESTOR-01**: Gestor vê receita do mês consolidada (à vista, mensalista, total)
- [x] **GESTOR-02**: Gestor vê contagem de vendas por produto/tier no mês
- [x] **GESTOR-03**: Gestor vê comissão total por closer e por SDR/SS no mês (referência e pagamento)
- [x] **GESTOR-04**: Gestor acompanha o atingimento de meta de todos os colaboradores em uma visão única

### Confiança e Auditoria (AUDIT)

- [x] **AUDIT-01**: O sistema registra histórico de alterações em campos que afetam comissão (marcar como pago, editar valor, mudar plano)
- [x] **AUDIT-02**: Admin exporta vendas, comissões e metas para Excel/CSV

### Importação do Histórico (IMPORT)

- [x] **IMPORT-01**: Script importa o histórico da planilha de Comissões de Vendas para o banco (Desempenho Time descoped — ver 10-SUMMARY.md)
- [x] **IMPORT-02**: A importação recomputa a comissão a partir dos fatos brutos e reconcilia com os totais das planilhas, gerando um relatório de divergências (não copia a coluna FÓRMULA cegamente)
- [x] **IMPORT-03**: A importação é idempotente (rodar de novo não duplica dados) e valida antes de carregar

## Backlog reconhecido (sem fase atribuída)

Ideias registradas no v1 e ainda não priorizadas. NÃO confundir com os
requisitos v2 (plano de pagamento e valor presente), mais abaixo — aqueles
estão mapeados para as fases 11 a 16.

### Planos e Regras (PLAN)

- **PLAN-01**: Interface visual para editar faixas e overrides de plano com pré-visualização
- **PLAN-02**: Simulador de comissão ("e se eu bater X% da meta?")

### Engajamento (ENG)

- **ENG-01**: Ranking/leaderboard entre colaboradores
- **ENG-02**: Notificações/alertas (e-mail ou in-app) de proximidade/estouro de meta

### Integrações (INT)

- **INT-01**: Sincronização automática de status de pagamento com gateways (ASAAS/Pagar.me/Inter/Guru)

## Out of Scope

Explicitamente excluído para evitar aumento de escopo.

| Feature | Motivo |
|---------|--------|
| Conciliação financeira/contábil completa (aba FINANCEIRO) | Foco do v1 é comissão + meta, não fechamento contábil |
| Integração com folha de pagamento | Fora do domínio de acompanhamento comercial |
| Gestão de pipeline/CRM | Ferramenta é de comissão e meta, não CRM |
| Construtor de regras no-code genérico | Over-engineering para ~5-20 usuários; formatos são poucos e conhecidos |
| Multi-moeda | Empresa opera só em BRL |
| App mobile nativo | Web responsivo atende |
| Papéis BDR e Sócio/Parceiro | Não priorizados no v1; podem entrar depois |
| Fluxos de aprovação multinível de comissão | Time pequeno; gestor único aprova |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| COLAB-07 | Phase 1 | Complete |
| COLAB-01 | Phase 2 | Complete |
| COLAB-02 | Phase 2 | Complete |
| COLAB-03 | Phase 2 | Complete |
| COLAB-04 | Phase 2 | Complete |
| COLAB-05 | Phase 2 | Complete |
| COLAB-06 | Phase 2 | Complete |
| VENDA-01 | Phase 3 | Complete |
| VENDA-02 | Phase 3 | Complete |
| VENDA-03 | Phase 3 | Complete |
| VENDA-04 | Phase 3 | Complete |
| VENDA-05 | Phase 3 | Complete |
| PGTO-01 | Phase 4 | Complete |
| PGTO-02 | Phase 4 | Complete |
| PGTO-03 | Phase 4 | Complete |
| COMIS-01 | Phase 5 | Complete |
| COMIS-02 | Phase 5 | Complete |
| COMIS-03 | Phase 5 | Complete |
| COMIS-04 | Phase 5 | Complete |
| COMIS-05 | Phase 5 | Complete |
| COMIS-06 | Phase 5 | Complete |
| COMIS-07 | Phase 5 | Complete |
| AUDIT-01 | Phase 5 | Complete |
| META-01 | Phase 6 | Complete |
| META-02 | Phase 6 | Complete |
| META-03 | Phase 6 | Complete |
| META-04 | Phase 6 | Complete |
| AGEND-01 | Phase 7 | Complete |
| AGEND-02 | Phase 7 | Complete |
| AGEND-03 | Phase 7 | Complete |
| PAINEL-01 | Phase 8 | Complete |
| PAINEL-02 | Phase 8 | Complete |
| PAINEL-03 | Phase 8 | Complete |
| PAINEL-04 | Phase 8 | Complete |
| GESTOR-01 | Phase 9 | Complete |
| GESTOR-02 | Phase 9 | Complete |
| GESTOR-03 | Phase 9 | Complete |
| GESTOR-04 | Phase 9 | Complete |
| AUDIT-02 | Phase 9 | Complete |
| IMPORT-01 | Phase 10 | Complete |
| IMPORT-02 | Phase 10 | Complete |
| IMPORT-03 | Phase 10 | Complete |

**Coverage:**
- v1 requirements: 47 total (contagem corrigida — a nota inicial de "43 total" estava desatualizada; a contagem real de IDs nas categorias acima é 47)
- Mapped to phases: 47/47 ✓
- Complete: 47/47 ✓
- Unmapped: 0

---

## v2 Requirements — Plano de Pagamento e Valor Presente

**Definidos:** 2026-08-02, a partir da apuração real de julho/2026
(`docs/APURACAO-COMERCIAL-NEXT.md`) e das decisões de negócio confirmadas com a
gestão na mesma data (bloco abaixo).

### Regras de negócio confirmadas em 02/08/2026

Estas regras não estavam escritas em lugar nenhum antes desta data. Três delas
(50% de entrada, boleto, base da comissão) também não estão no documento de
apuração — foram confirmadas em conversa e são a fundação do v2.

**1. O que decide se o dinheiro conta cheio no mês é a Next já ter garantido o
recebimento.**

| Forma de pagamento | Conta no mês | Comissão do closer |
|---|---|---|
| PIX / sinal | valor cheio | sobre o valor cheio, no mês |
| Cartão parcelado (12x aprovado de uma vez) | valor cheio | sobre o valor cheio, no mês |
| Boleto parcelado | só o boleto pago | só sobre o boleto pago |
| Recorrência / assinatura | só a parcela paga | só sobre a parcela paga |

Cartão aparece dos dois lados: parcelado em transação única conta cheio (a
operadora aprovou tudo, o cliente não cancela o que falta); assinatura recorrente
não conta cheio (o cliente cancela quando quiser). No modelo de dados esse
atributo se chama `contaCheioNoMes` — **não** usar "irrevogável"/"garantido", que
não são termos reconhecidos pelo usuário.

As 4 "ressalvas" da §2 do documento são consequência dessa regra única, não quatro
casos independentes:

```
valor presente do mês = Σ componentes contaCheioNoMes com data no mês
                      + Σ parcelas recebidas dos demais componentes
```

**2. Para o cartão parcelado, "pago" significa "venda aprovada"** — não "as 12
parcelas caíram". É como a planilha já trata hoje (Cliente B: status `Pago`, coluna
V = 60.000, comissão sobre 60k em julho). Isso é o que concilia "só comissiona
parcela paga" com "cartão 12x comissiona cheio no mês".

**3. Toda venda exige no mínimo 50% de entrada.** A Next não aceita mais venda
100% recorrência. A entrada pode ser parcelada em 12x no cartão, desde que seja o
modelo de pagamento completo do cartão, não assinatura. Consequência: a ressalva
(4) do documento (100% recorrência conta 1 parcela) vira regra **apenas
histórica** — a venda 100% recorrência de julho/2026 precisa continuar representável, mas
o formulário deve recusar cadastro novo abaixo de 50%.

**4. Cada componente da negociação tem data e forma próprias, e precisa ser
explicável.** Negociações fora do padrão são comuns (3 cartões diferentes, boleto
começando em outro mês, sinal + saldo em data combinada) e hoje só existem como
texto livre no WhatsApp.

### Plano de Pagamento e Valor Presente (PGMT)

- [ ] **PGMT-01**: A venda registra N componentes de pagamento, cada um com forma (PIX, sinal, cartão parcelado, boleto, recorrência), valor, nº de parcelas, data prevista e descrição livre
- [ ] **PGMT-02**: Cada componente declara se conta cheio no mês ou parcela a parcela (`contaCheioNoMes`), derivado da forma mas explícito no dado
- [ ] **PGMT-03**: O sistema calcula o valor presente do mês a partir dos componentes, sem interpretação humana
- [ ] **PGMT-04**: Componente com data em outro mês não entra no valor presente do mês do fechamento — entra no mês da própria data
- [ ] **PGMT-05**: O cadastro de venda nova é recusado quando a entrada é menor que 50% do TCV; vendas históricas abaixo disso continuam válidas
- [ ] **PGMT-06**: O cronograma de parcelas passa a ser gerado a partir dos componentes, não dos campos escalares entrada/valorMensalidade/numeroParcelas
- [ ] **PGMT-07**: As vendas já cadastradas (261 históricas + julho/2026) são convertidas para componentes sem alterar nenhum valor já apurado ou fechado
- [ ] **PGMT-08**: O valor presente calculado bate ao centavo com os 14 fechamentos de julho/2026 — R$ 604.833,33 — usando os 6 casos da §3 do documento como fixture

### Faturamento e Metas (FATUR)

- [ ] **FATUR-01**: O gestor vê TCV, valor presente e caixa do mês como três números distintos, na mesma tela
- [ ] **FATUR-02**: O faturamento do mês é apresentado como valor presente das vendas novas + recorrência da carteira recebida, com os dois lados visíveis (julho/2026: 604.833,33 + 107.014,26 = 711.847,59)
- [ ] **FATUR-03**: A meta do closer passa a ser medida em valor presente, não em caixa recebido
- [ ] **FATUR-04**: O admin define uma meta mensal da empresa, em valor presente, além das metas por colaborador
- [ ] **FATUR-05**: O dashboard mostra o atingimento da meta da empresa no mês
- [ ] **FATUR-06**: O gestor vê a composição do valor presente por forma de pagamento (quanto é caixa, quanto é cartão contado cheio, quanto é recorrência)

### Comissão sobre Valor Presente (COMIS, continuação do v1)

- [ ] **COMIS-08**: A base da comissão do closer passa a ser o valor presente do mês
- [ ] **COMIS-09**: Componente `contaCheioNoMes` comissiona integralmente no mês do fechamento; boleto e recorrência comissionam só quando a parcela é efetivamente paga
- [ ] **COMIS-10**: A mudança de base não altera nenhuma apuração já FECHADA — vale a partir de uma competência de corte explícita

### Cliente como Entidade (CLIENTE)

- [ ] **CLIENTE-01**: Aluno e pagador deixam de ser texto livre e viram registro próprio com ID
- [ ] **CLIENTE-02**: Vendas do mesmo aluno ficam ligadas entre si (renovação, upgrade, segunda compra)
- [ ] **CLIENTE-03**: A conversão do histórico deduplica grafias divergentes do mesmo aluno, com relatório do que foi unificado

### Conciliação com Gateways (CONCIL)

- [ ] **CONCIL-01**: A parcela guarda o `transaction_id` do gateway que a originou
- [ ] **CONCIL-02**: Importar o extrato do Asaas/Pagar.me concilia pagamentos por `transaction_id`, não por nome de aluno
- [ ] **CONCIL-03**: Divergências entre extrato e parcelas viram relatório explícito, nunca são aceitas em silêncio

### Integração GHL (GHL)

- [ ] **GHL-01**: Reuniões agendadas e realizadas vêm do GHL, deduplicadas por `contactId` (reagendamento não reconta)
- [ ] **GHL-02**: Os calendários apuráveis são configuráveis; D&F e Pós-Vendas nunca contam como agendamento de pré-venda
- [ ] **GHL-03**: A atribuição da pessoa usa `createdBy.userId`, não `assignedUserId`
- [ ] **GHL-04**: Leads são contados pelas tags `orgânico` e `tráfego-pago`; a tag `mql` marca MQL
- [ ] **GHL-05**: O dashboard mostra taxa de presença e conversão call → venda (julho/2026: 84,0% e 8,9%)

### Mapa v2: requisito → fase

| Requisito | Fase | Status |
|-----------|------|--------|
| PGMT-01..08 | Phase 11 | Pending |
| FATUR-01, 02, 06 | Phase 12 | Pending |
| FATUR-03, 04, 05 | Phase 12 | Pending |
| COMIS-08, 09, 10 | Phase 13 | Pending |
| CLIENTE-01, 02, 03 | Phase 14 | Pending |
| CONCIL-01, 02, 03 | Phase 15 | Pending |
| GHL-01..05 | Phase 16 | Pending |

**Coverage v2:**
- v2 requirements: 27 total
- Mapped to phases: 27/27 ✓
- Complete: 0/27

### Pontos ainda em aberto (não viram requisito até serem respondidos)

Herdados da §11 do documento de apuração, ainda sem resposta da gestão:

1. **A regra do percentual de comissão** — varia por pessoa, produto, origem ou acordo? O `PlanoComissao` config-driven já suporta qualquer uma dessas leituras sem migração, mas **não modelar como percentual fixo por pessoa antes da confirmação**.
2. **O que `OTE` substitui na prática** — o formato `salario_bonus_atingimento` já existe; falta confirmar se substitui totalmente a comissão por venda ou complementa.
3. **Como unificar as duas carteiras** (abas de comissão × abas FINANCEIRO/Guru), que hoje têm alunos e gateways diferentes.
4. **Contratos sem parcela definida** (`0/6`, `0/10`) cuja cobrança nunca começou.

---
*Requirements defined: 2026-07-01*
*Last updated: 2026-08-02 — v2 (plano de pagamento e valor presente) definido a partir da apuração de julho/2026; v1 permanece 47/47 completo*
