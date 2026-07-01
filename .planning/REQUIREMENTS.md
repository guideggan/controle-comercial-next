# Requirements: Controle Comercial NEXT

**Defined:** 2026-07-01
**Core Value:** Cada colaborador vê sozinho quanto falta pra sua meta e quanto vai receber de comissão; o gestor cadastra a venda uma vez e o sistema faz todo o cálculo automaticamente.

## v1 Requirements

Requisitos da primeira entrega. Cada um mapeia para uma fase do roadmap.

### Autenticação e Acesso (AUTH)

- [ ] **AUTH-01**: Colaborador faz login com e-mail e senha
- [ ] **AUTH-02**: Sessão persiste entre recarregamentos do navegador e carrega papel + colaborador vinculado
- [ ] **AUTH-03**: Colaborador (Closer/SDR/SS) só acessa e vê os próprios dados; a restrição é imposta no servidor, não só na interface
- [ ] **AUTH-04**: Admin/Gestor acessa todos os dados e todas as telas de cadastro
- [ ] **AUTH-05**: Admin pode criar, desativar e redefinir senha de contas de colaboradores

### Colaboradores e Planos de Comissão (COLAB)

- [ ] **COLAB-01**: Admin cadastra colaborador com nome, papel (Admin/Gestor, Closer, SDR, SS) e dados de contato/PIX
- [ ] **COLAB-02**: Admin define o plano de comissão de cada colaborador, escolhendo o formato: % fixo sobre o recebido
- [ ] **COLAB-03**: Admin define plano de comissão no formato progressivo por atingimento de meta (faixas de % conforme % da meta batida)
- [ ] **COLAB-04**: Admin define plano de comissão no formato fixo + variável (valor garantido + % por cima)
- [ ] **COLAB-05**: Admin define plano de comissão de SDR/SS por quantidade de calls (agendamentos) realizadas
- [ ] **COLAB-06**: Plano de comissão é versionado por vigência (início/fim), de forma que mudanças não reescrevem o histórico já apurado
- [ ] **COLAB-07**: Admin cadastra e edita produtos/tiers (START/PRO/MASTER/PADRÃO/Elite) usados nas vendas

### Vendas e Parcelas (VENDA)

- [ ] **VENDA-01**: Admin cadastra uma venda em um único formulário (data, aluno, pagador, plataforma, produto, tipo de pgto à vista/mensalista, TCV, entrada, valor da mensalidade, nº de parcelas, dia de vencimento, closer, SDR/SS, observação)
- [ ] **VENDA-02**: Ao salvar uma venda mensalista, o sistema gera automaticamente as parcelas mensais previstas (entrada + N mensalidades) de forma atômica com a venda
- [ ] **VENDA-03**: O dia de vencimento é ancorado, de modo que parcelas em meses curtos não escorregam permanentemente (31→30→29)
- [ ] **VENDA-04**: Admin edita/corrige uma venda e suas parcelas, com as devidas travas quando um mês já foi fechado
- [ ] **VENDA-05**: Admin lista e busca vendas por aluno, closer, produto, status e mês de referência

### Recebimentos (PGTO)

- [ ] **PGTO-01**: Admin marca cada parcela/entrada como Paga ou Pendente, informando valor recebido e data do pagamento
- [ ] **PGTO-02**: O sistema calcula o "valor recebido no mês" somando entrada + mensalidades + vendas à vista efetivamente pagas naquele mês, sem dupla contagem
- [ ] **PGTO-03**: Somente valores com status Pago entram na base de comissão; pendentes contam como zero

### Motor de Comissão e Apuração (COMIS)

- [ ] **COMIS-01**: A comissão incide sobre o valor recebido no mês, nunca sobre o TCV
- [ ] **COMIS-02**: O motor calcula a comissão de cada colaborador conforme o formato do plano dele (fixo, progressivo, fixo+variável, por calls)
- [ ] **COMIS-03**: Valores monetários usam decimal exato e o arredondamento ocorre uma única vez no total (não por faixa/parcela)
- [ ] **COMIS-04**: A apuração separa mês de referência (competência) do mês de pagamento (mês seguinte), ambos gravados explicitamente
- [ ] **COMIS-05**: A apuração é gravada como snapshot imutável por pessoa/mês; os painéis leem o snapshot e não recalculam ao vivo
- [ ] **COMIS-06**: Admin pode "fechar/travar" a apuração de um mês, impedindo alterações retroativas silenciosas
- [ ] **COMIS-07**: Extrato de comissão por pessoa/mês mostra, linha a linha, como o valor foi calculado (vendas, valores recebidos, % aplicado, total)

### Metas e Proração Semanal (META)

- [ ] **META-01**: Admin define a meta de cada colaborador por mês (valor em R$ para closer; nº de agendamentos para SDR/SS)
- [ ] **META-02**: O sistema quebra a meta mensal em metas semanais proporcionais acumuladas
- [ ] **META-03**: Para cada semana o sistema mostra realizado, meta proporcional, % atingido, % esperado e saldo
- [ ] **META-04**: O realizado do closer soma vendas à vista + mensalistas recebidos; o do SDR/SS soma agendamentos

### Agendamentos SDR/SS (AGEND)

- [ ] **AGEND-01**: SDR/SS registra agendamentos com status (agendado, realizado, no-show, cancelado) por dia da semana
- [ ] **AGEND-02**: O total de calls realizadas alimenta tanto a comissão do SDR/SS quanto o painel de meta, a partir de uma única fonte de dados
- [ ] **AGEND-03**: Painel de agendadas × realizadas por dia (segunda a sábado) para a semana corrente

### Painel do Colaborador (PAINEL)

- [ ] **PAINEL-01**: Colaborador vê o próprio acompanhamento de meta do mês (meta, realizado, meta proporcional, % esperado vs atingido, saldo)
- [ ] **PAINEL-02**: Colaborador vê a própria comissão prevista/apurada do mês corrente
- [ ] **PAINEL-03**: Colaborador vê o próprio extrato de comissão e histórico de meses anteriores
- [ ] **PAINEL-04**: SDR/SS vê o próprio painel de agendadas × realizadas

### Dashboard do Gestor (GESTOR)

- [ ] **GESTOR-01**: Gestor vê receita do mês consolidada (à vista, mensalista, total)
- [ ] **GESTOR-02**: Gestor vê contagem de vendas por produto/tier no mês
- [ ] **GESTOR-03**: Gestor vê comissão total por closer e por SDR/SS no mês (referência e pagamento)
- [ ] **GESTOR-04**: Gestor acompanha o atingimento de meta de todos os colaboradores em uma visão única

### Confiança e Auditoria (AUDIT)

- [ ] **AUDIT-01**: O sistema registra histórico de alterações em campos que afetam comissão (marcar como pago, editar valor, mudar plano)
- [ ] **AUDIT-02**: Admin exporta vendas, comissões e metas para Excel/CSV

### Importação do Histórico (IMPORT)

- [ ] **IMPORT-01**: Script importa o histórico das duas planilhas atuais (Comissões de Vendas e Desempenho do Time) para o banco
- [ ] **IMPORT-02**: A importação recomputa a comissão a partir dos fatos brutos e reconcilia com os totais das planilhas, gerando um relatório de divergências (não copia a coluna FÓRMULA cegamente)
- [ ] **IMPORT-03**: A importação é idempotente (rodar de novo não duplica dados) e valida antes de carregar

## v2 Requirements

Reconhecidos, porém adiados.

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
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| COLAB-07 | Phase 1 | Pending |
| COLAB-01 | Phase 2 | Pending |
| COLAB-02 | Phase 2 | Pending |
| COLAB-03 | Phase 2 | Pending |
| COLAB-04 | Phase 2 | Pending |
| COLAB-05 | Phase 2 | Pending |
| COLAB-06 | Phase 2 | Pending |
| VENDA-01 | Phase 3 | Pending |
| VENDA-02 | Phase 3 | Pending |
| VENDA-03 | Phase 3 | Pending |
| VENDA-04 | Phase 3 | Pending |
| VENDA-05 | Phase 3 | Pending |
| PGTO-01 | Phase 4 | Pending |
| PGTO-02 | Phase 4 | Pending |
| PGTO-03 | Phase 4 | Pending |
| COMIS-01 | Phase 5 | Pending |
| COMIS-02 | Phase 5 | Pending |
| COMIS-03 | Phase 5 | Pending |
| COMIS-04 | Phase 5 | Pending |
| COMIS-05 | Phase 5 | Pending |
| COMIS-06 | Phase 5 | Pending |
| COMIS-07 | Phase 5 | Pending |
| AUDIT-01 | Phase 5 | Pending |
| META-01 | Phase 6 | Pending |
| META-02 | Phase 6 | Pending |
| META-03 | Phase 6 | Pending |
| META-04 | Phase 6 | Pending |
| AGEND-01 | Phase 7 | Pending |
| AGEND-02 | Phase 7 | Pending |
| AGEND-03 | Phase 7 | Pending |
| PAINEL-01 | Phase 8 | Pending |
| PAINEL-02 | Phase 8 | Pending |
| PAINEL-03 | Phase 8 | Pending |
| PAINEL-04 | Phase 8 | Pending |
| GESTOR-01 | Phase 9 | Pending |
| GESTOR-02 | Phase 9 | Pending |
| GESTOR-03 | Phase 9 | Pending |
| GESTOR-04 | Phase 9 | Pending |
| AUDIT-02 | Phase 9 | Pending |
| IMPORT-01 | Phase 10 | Pending |
| IMPORT-02 | Phase 10 | Pending |
| IMPORT-03 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 47 total (contagem corrigida — a nota inicial de "43 total" estava desatualizada; a contagem real de IDs nas categorias acima é 47)
- Mapped to phases: 47/47 ✓
- Unmapped: 0

---
*Requirements defined: 2026-07-01*
*Last updated: 2026-07-01 after roadmap creation (10 phases, full traceability mapped)*
