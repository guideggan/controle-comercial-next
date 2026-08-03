# Apuração Comercial Next Ecommerce — regras, fluxo e estrutura de dados

> Documento de referência levantado em 02/08/2026 a partir da apuração real de julho/2026.
> Serve para avaliar se um sistema integrado (Asaas + GHL + carteira de mensalistas)
> contempla as regras que hoje vivem espalhadas entre planilha, CRM e WhatsApp.
>
> **Tudo o que está aqui foi verificado contra dados reais.** Onde há incerteza, está
> marcado como ⚠️ **INCERTO**.

---

## 1. O problema que um hub precisa resolver

Hoje a apuração comercial da Next depende de **quatro fontes desconectadas**, e nenhuma
delas sozinha responde "quanto faturamos no mês":

| Fonte | O que só ela tem | O que falta nela |
|---|---|---|
| **GHL (GoHighLevel)** | agendamentos, calls realizadas, leads, tags de canal, oportunidades | forma de pagamento real; o campo de valor é preenchido errado com frequência |
| **Grupo de WhatsApp `Reports \| Comercial`** | **a forma de pagamento de cada venda** — parcelamento, entrada, recorrência | é texto livre, não é base de dados |
| **Planilha `Comissões_Vendas - NEXT`** (Google Sheets) | carteira de mensalistas, parcelas, comissões | não sabe de leads nem de calls; fórmulas quebradas |
| **Gateways: Asaas, Pagar.me, Guru** | o que efetivamente foi pago | não sabe a que venda/closer pertence |

O dado crítico — **como a venda foi paga** — só existe em texto livre no WhatsApp. É a
maior fragilidade do processo atual e o principal candidato a virar campo estruturado.

---

## 2. A regra de faturamento (o coração de tudo)

A base é o **TCV** (*Total Contract Value* — valor cheio do contrato), com **quatro
ressalvas** que transformam TCV em **valor presente** (o que conta no mês).

> **Regra confirmada pela gestão em 02/08/2026.** A meta mensal é de valor presente,
> não de TCV.

### As quatro ressalvas

**(1) Cartão parcelado conta cheio.**
Contrato pago em 12x no cartão entra **integralmente** no mês do fechamento, como se
fosse à vista.
*Ex.: R$ 60.000 em 12x cartão → R$ 60.000 no mês.*

**(2) Quando há entrada + recorrência, só a entrada conta.**
A recorrência vira parcela mensal nos meses seguintes.
*Ex.: R$ 50.000 de entrada (mesmo parcelada em 12x no cartão) + R$ 46.000 em 12x de
recorrência → R$ 50.000 no mês + R$ 3.833,33/mês depois.*

**(3) Pagamento com data em outro mês não conta no mês.**
Vale a data em que a parcela efetivamente entra.
*Ex.: venda em 31/07 com R$ 5.000 de sinal + R$ 25.000 em 03/08 → só R$ 5.000 em julho.*

**(4) Venda 100% recorrência conta a primeira parcela.**
Se a venda não tem entrada nenhuma, conta **uma parcela** no mês do fechamento — senão
apareceria zerada. **Não vale para vendas que já têm entrada própria.**
*Ex.: R$ 46.000 em 12x de recorrência, sem entrada → R$ 3.833,33 no mês.*

### Distinção que precisa estar clara no sistema

| Conceito | O que é |
|---|---|
| **TCV** | valor cheio do contrato assinado |
| **Valor presente** | o que conta no mês pelas 4 ressalvas — **é a métrica da meta** |
| **Caixa** | o dinheiro que realmente entrou na conta no mês |

Os três são diferentes. Em julho/2026: TCV R$ 859.000 · valor presente R$ 604.833,33 ·
caixa aproximadamente R$ 159.000. **Só ~26% do valor presente vira dinheiro no mês** —
o resto é cartão parcelado contado cheio. Quem comunicar o número para a diretoria
precisa saber disso.

### Fórmula do faturamento do mês

```
Faturamento do mês = Vendas novas (valor presente) + Recorrência da carteira (parcelas pagas)
```

Julho/2026: R$ 604.833,33 + R$ 107.014,26 = **R$ 711.847,59**

---

## 3. A planilha de comissões — estrutura

Arquivo: `Comissões_Vendas - NEXT.xlsx` · **editada no Google Sheets**
(as fórmulas usam `REGEXREPLACE`, função que só existe no Sheets).

### Organização das abas

Uma aba por mês, nomeada `<MÊS DO MOVIMENTO>PGTO <MÊS DO PAGAMENTO DA COMISSÃO>`:

```
JULHOPGTO AGOSTO   ← vendas e parcelas de julho, comissão paga em agosto
JUNHOPGTO JULHO    ← vendas e parcelas de junho, comissão paga em julho
MAIOPGTO JUNHO
...
```

**A comissão é sempre paga no mês seguinte ao recebimento.**

Abas auxiliares: `Deshboard` (painel de comissões por pessoa), `IMERSÃOPGTO JULHO` e
`PIX IMERSÃO` (evento à parte), `FINANCEIRO AGOSTO` e `FINANCEIRO - NÃO MEXER`
(carteira antiga, ver seção 7).

### Os dois blocos dentro de cada aba mensal

Esta é a chave da modelagem:

| Bloco | Linhas (ref. julho/2026) | O que é | Coluna que vale |
|---|---|---|---|
| **Carteira** | 2 a 78 | mensalistas antigos — uma linha por parcela do mês | **`I`** (valor da parcela) |
| **Vendas novas** | 79 em diante | vendas fechadas no mês | **`V`** (valor presente) |

> ⚠️ As linhas são **posicionais**, não há coluna que marque a qual bloco a linha
> pertence. As fórmulas de total dependem de intervalos fixos. É a maior fragilidade
> estrutural da planilha e some naturalmente num sistema com tabela relacional.

### Dicionário de colunas

| Col | Nome | Conteúdo | Observações |
|---|---|---|---|
| A | DATA | data da venda | serial de data |
| B | ALUNO | nome do cliente | chave de conciliação — **texto livre, sem ID** |
| C | PAGADOR | quem paga (pode diferir do aluno) | importante: CNPJ/cônjuge/terceiro |
| D | COMPROVANTE | link ou marcação | |
| E | PLATAFORMA | `ASAAS`, `PAGAR.ME` | gateway de cobrança |
| F | PRODUTO | `START`, `PRO`, `MASTER`, `ELITE`, `PADRÃO` | |
| G | **TIPO DE PGTO** | **`À vista`** ou **`Mensalista`** | **decide como a venda entra** |
| H | VALOR TOTAL DA VENDA | **TCV** | |
| I | ENTRADA | venda nova: a entrada · carteira: a parcela do mês | duplo sentido conforme o bloco |
| J | MENSALIDADE | valor da parcela recorrente | preenchida de forma inconsistente |
| K | PARCELA | `07/12` = parcela 7 de 12 | avanço manual todo mês |
| L | DIA VENCIMENTO | dia do mês | |
| M | MÊS DE REFERÊNCIA | mês de início do contrato | |
| N | OBS | **forma de pagamento em texto livre** | copiado do WhatsApp |
| O | **STATUS** | `Pago` / `Pendente` | **comissão só sobre `Pago`** |
| P | CLOSER | nome | texto livre |
| Q | % COMISSÃO CLOSER | ex.: `0,03` | |
| R | COMISSÃO CLOSER | `= base × Q` | |
| S | SDR | nome ou marcador | texto livre |
| T | % COMISSÃO SDR | ex.: `0,015` | |
| U | COMISSÃO SDR | `= base × T` | |
| V | FORMÚLA | **o valor presente da venda** | é o que soma no total do mês |

### Como preencher uma venda nova

```
Pagamento é 12x cartão ou PIX (entra cheio)
  → G = "À vista"      I = 84 (placeholder)     V = H (TCV cheio)

Pagamento tem entrada + recorrência
  → G = "Mensalista"   I = valor da entrada     J = parcela mensal    V = I

Pagamento é 100% recorrência, sem entrada
  → G = "Mensalista"   I = valor de 1 parcela   J = mesma parcela     V = I
```

> ⚠️ O `I = 84` nas linhas "À vista" é um **placeholder sem significado**. Não é valor.
> Num sistema, esse campo simplesmente não existiria.

### Exemplos reais de julho/2026

| Aluno | Forma de pagamento | G | H (TCV) | I | V |
|---|---|---|---|---|---|
| Cliente A | 72k PIX + 72k 12x cartão | À vista | 144.000 | 84 | **144.000** |
| Cliente B | 12x cartão | À vista | 60.000 | 84 | **60.000** |
| Cliente C | 50k entrada 12x + 46k recorrência 12x | Mensalista | 96.000 | 50.000 | **50.000** |
| Cliente D | 100% recorrência 12x | Mensalista | 46.000 | 3.833,33 | **3.833,33** |
| Cliente E | 5k sinal + 25k em 03/08 + 30k recorrência 6x | Mensalista | 60.000 | 5.000 | **5.000** |
| Cliente F | 50k em 3 cartões 12x (25k jun + 25k jul) + 46k boleto | Mensalista | 96.000 | 25.000 | **25.000** |

---

## 4. Cálculo da comissão

### Fórmula

```
Comissão closer = base × % do closer
Comissão SDR    = base × % do SDR

onde base =  V  (se for venda nova)
             I  (se for parcela da carteira)

e a comissão só existe se STATUS = "Pago"
```

**A comissão incide sobre o valor recebido, não sobre o TCV.** Uma venda de R$ 96.000
com R$ 50.000 de entrada gera comissão sobre os R$ 50.000 no mês do fechamento, e
depois sobre cada parcela da recorrência conforme ela for paga.

### Percentuais observados (jun–jul/2026)

| Papel | Valor | Frequência |
|---|---|---|
| Closer | **3%** | padrão dominante |
| Closer | 2% · 2,5% · 4% · 5% | casos específicos |
| SDR/SS | **1,5%** | padrão dominante |
| SDR/SS | 0,5% | casos específicos |

> ⚠️ **INCERTO — a regra que define o percentual não foi encontrada.** Os valores
> variam por linha sem critério explícito na planilha. Pelos dados, Yuri costuma
> aparecer com 3% e Paola com 2% ou 2,5%, mas há exceções. **Não modelar como
> percentual fixo por pessoa sem antes confirmar com a gestão** — pode variar por
> produto, por origem do lead ou por acordo individual.

### Marcadores especiais

Nas colunas de percentual e de SDR aparecem valores que **não são números**:

| Marcador | Significado |
|---|---|
| `OTE` | *On Target Earnings* — a pessoa é remunerada por variável fixo, **sem comissão por venda** |
| `-` | não se aplica |
| `A definir` | pendente de decisão da gestão |
| `RENOVAÇÃO` | venda de renovação (na coluna SDR) |
| `INDICAÇÃO` | lead veio de indicação |
| `IMERSÃO` / `UPGRADE` | origem específica |

> ⚠️ Há **sujeira de digitação**: valores absolutos (`1750`, `6500`, `3152`) digitados
> nas colunas de percentual. Um sistema precisa de validação de tipo aqui.

---

## 5. O processo mensal, passo a passo

Como a virada de mês funciona hoje, manualmente:

**1. Duplicar a aba do mês anterior** e renomear (`JULHOPGTO AGOSTO`).

**2. Descer as vendas novas para a carteira.** As vendas do mês anterior deixam de ser
"venda nova" e viram mensalistas. Isso exige **duas correções que hoje falham**:
   - **zerar a coluna `V`** (o dinheiro delas já foi contado no mês anterior)
   - **trocar `I` de "entrada" para "valor da parcela"**

   *Erro real encontrado:* em julho/2026, Cliente G estava com `I = 40.000` (a
   entrada PIX paga em junho) em vez de `4.666,66` (a parcela). Cliente H com
   `I = 81.000` em vez de `1.250`. Se não corrigido, o mês conta R$ 115.083 de dinheiro
   que já entrou no mês anterior.

**3. Avançar a parcela (`K`) de todos os mensalistas.** `07/12` → `08/12`.
   *Erro real encontrado:* 71 dos 72 mensalistas estavam com a parcela congelada em junho.

**4. Encerrar contratos que chegaram ao fim** (parcela atual = total) e removê-los.

**5. Lançar as vendas novas do mês** no bloco de baixo, com `G`, `I`, `J`, `V`
   conforme a seção 3.

**6. Conciliar o status `Pago`/`Pendente`** de cada parcela contra o gateway
   (Asaas / Pagar.me / Guru).

**7. Conferir os totais** — À vista + Mensalistas.

### A fonte de verdade das vendas novas

**É o grupo de WhatsApp, não o CRM.** Todo fechamento é postado pelo closer no grupo
`Reports | Comercial` neste formato:

```
NEXT ECOMMERCE  *MASTER*

Cliente A - <empresa>

SDR/SS - João Pedro
Ciclo: 6 meses + 30 dias
Entregáveis: Padrão

Data da Venda/Pagamento: 30/07

Forma de Pagamento: *144k* = 72k PIX - 72k 12x CARTAO
```

Depois, alguém posta a lista numerada acumulada do mês (`Fechamentos JULHO: 1) ... 2) ...`).

> ⚠️ **A lista numerada não é confiável.** Em julho/2026 uma venda (um cliente, R$ 60.000)
> foi postada individualmente às 18h02 e ficou **fora** da lista consolidada postada às
> 20h15. Sempre conferir contra os posts individuais.

---

## 6. Problemas conhecidos da planilha

Levantados na apuração de julho/2026. **Todos desaparecem num sistema relacional** —
listados aqui como requisitos implícitos.

| # | Problema | Impacto |
|---|---|---|
| 1 | Fórmulas do Google Sheets (`REGEXREPLACE`) viram `DUMMYFUNCTION` no Excel | totais congelam com valor cacheado; ninguém percebe |
| 2 | Fórmula de mensalistas aponta para coluna `J`, que está quase vazia | se recalcular hoje, vai a zero |
| 3 | Blocos definidos por intervalo fixo de linhas (`I2:I78`) | inserir linha quebra a conta silenciosamente |
| 4 | Parcela (`K`) avançada manualmente, aluno por aluno | 71 de 72 estavam congelados |
| 5 | `I` muda de significado conforme o bloco | fonte recorrente de dupla contagem |
| 6 | Forma de pagamento em texto livre | impossível calcular; só leitura humana |
| 7 | Conciliação por **nome do aluno**, sem ID | grafias divergentes entre fontes |
| 8 | Placeholder `84` em campo numérico | poluição de dados |
| 9 | Valores absolutos digitados em coluna de percentual | erro de tipo sem validação |
| 10 | Duas carteiras paralelas (abas de comissão × abas FINANCEIRO) com alunos diferentes | risco de omissão |

---

## 7. As duas carteiras paralelas

Ponto de atenção para a integração: **existem duas bases de mensalistas que não se
conversam**.

| Base | Onde | Gateways | Alunos |
|---|---|---|---|
| Carteira de comissões | abas `<MÊS>PGTO <MÊS>` | ASAAS, PAGAR.ME | ~72 em julho/2026 |
| Carteira financeira | abas `FINANCEIRO` | **Guru**, PAGAR.ME | outros alunos, mais antigos |

Os nomes **não coincidem** (ex.: três alunos aparecem
só na financeira). A aba `FINANCEIRO - NÃO MEXER` tem colunas próprias
(`Intermediador`, `Conciliação`) e usa outro formato de parcela (`PCLA 7/12`).

Um hub precisa unificar as duas ou, no mínimo, saber que existem — senão o faturamento
de recorrência sai subestimado.

---

## 8. Dados do GHL (CRM) usados na apuração

### Calendários

Apuráveis (contam como pré-venda):
```
4ijSLjkg8WYW5vBLpint   Paola
MIE6jJ0nShyoST1204MF   Yuri
iO56GuITKCvEtzJoWWt0   NextEcom
IurNggatfXTOYTz16WQa   Douglas/Pedro/Roberta
PgZPpCGx2D1JsCZ1N3Vl   Pedro
ZNkzdwYcYBgluxZyxdmB   Yuri-Paola
```

Excluídos da apuração:
```
siQz2JQJNeOjHmEUzJ22   D&F (reunião de proposta) — nunca conta como agendamento
F85wFBYt4YXC1QBfbcca   Pós-Vendas
```

### Custom fields de oportunidade

```
zjq3FKDmqs8fWDB22UqM   Valor à vista
RMcktgfHDEwTJltLSi87   Data Fechamento     ← filtrar por este, nunca por lastStatusChangeAt
6poQ0KzPmN1EsyX3FIRE   Valor recorrente mensal
80BGrUTjidfCeEVqri6l   Produto
FwsVS92YVSDolfI6CTkD   SDR/SS
OmG1WWwJzVQECBPOQVoB   Closer
TbCsCGfA686H1KtQeA5v   Origem Fechamento
cTwSUOKOfbBA65aBoLmR   Reunião Realizada
```

Dicionário completo: `GET /locations/{locationId}/customFields?model=opportunity`

### Regras de contagem de pré-vendas

- **Agendada** = 1x por lead, no dia da criação (`dateAdded`), deduplicado por
  `contactId`. Reagendamento **não** reconta.
- **Realizada** = `appointmentStatus == "showed"`, no dia da call (`startTime`).
- **Atribuição da pessoa** = campo `createdBy.userId` (NÃO `assignedUserId`, que é o
  closer dono do calendário).
- **Presença do closer** = `showed` por `assignedUserId`.
- **Leads** contam só pelas tags `orgânico` e `tráfego-pago`. Tag `mql` marca MQL.

### Confiabilidade dos campos do CRM

| Campo | Confiável? |
|---|---|
| `Data Fechamento` | ✅ sim — usar como filtro do mês |
| `Valor à vista` | ⚠️ **depende** — segue a mesma regra do valor presente (12x cartão preenchido cheio está correto), mas há erros de digitação. Conferir contra o WhatsApp |
| `SDR/SS` | ⚠️ vazio em ~30% das oportunidades |
| `Origem Fechamento` | ⚠️ vazio com frequência; quando preenchido, às vezes diverge do que o closer postou |
| tags de canal | ⚠️ são reajustadas ao longo do mês — reextração de meses passados dá números diferentes |

---

## 9. Requisitos para o hub integrado

O que o sistema precisa ter para substituir esse processo:

### Modelo de dados

**Venda (contrato)**
`id` · `cliente_id` · `pagador` · `produto` · `tcv` · `data_fechamento` · `closer_id` ·
`sdr_id` · `origem` · `ciclo` · `gateway`

**Plano de pagamento** — uma venda tem N componentes:
`venda_id` · `tipo` (`pix` | `cartao_parcelado` | `boleto` | `recorrencia` | `sinal`) ·
`valor` · `parcelas` · `data_prevista` · `conta_como_entrada` (bool)

> **Este é o campo que hoje não existe em lugar nenhum estruturado.** É o que permite
> calcular valor presente automaticamente em vez de interpretar texto livre.

**Parcela**
`plano_id` · `numero` · `total` · `valor` · `vencimento` · `status` ·
`gateway_transaction_id` · `data_pagamento`

**Comissão**
`parcela_id` ou `venda_id` · `pessoa_id` · `papel` (closer/sdr) · `percentual` ·
`valor` · `mes_competencia` · `mes_pagamento`

### Regras de negócio a implementar

1. **Cálculo de valor presente** a partir do plano de pagamento — as 4 ressalvas da
   seção 2, sem intervenção humana.
2. **Comissão só sobre parcela com status pago**, com o mês de pagamento sendo o
   seguinte ao da competência.
3. **Avanço automático de parcela** na virada do mês, com encerramento de contrato
   quando `numero == total`.
4. **Conciliação por ID de transação** do gateway, não por nome de aluno.
5. **Distinção explícita entre TCV, valor presente e caixa** — três números diferentes,
   os três visíveis.
6. **Meta mensal medida em valor presente.**

### Integrações

| Sistema | O que puxar | Chave |
|---|---|---|
| **Asaas / Pagar.me / Guru** | status e data de cada cobrança | `transaction_id` |
| **GHL** | oportunidade ganha, calls, leads, atribuição SDR/SS | `opportunity_id`, `contact_id` |
| **WhatsApp** *(opcional)* | o post de fechamento | seria substituído por um formulário |

> **A maior conquista do hub seria eliminar o post de WhatsApp como fonte de dados.**
> Um formulário de fechamento que capture o plano de pagamento estruturado resolve, de
> uma vez: o cálculo do valor presente, a base da comissão e a projeção de recorrência.

---

## 10. Números reais de julho/2026 (caso de teste)

Use como fixture para validar qualquer implementação.

| Indicador | Valor |
|---|---|
| Vendas fechadas | 14 |
| TCV contratado | R$ 859.000,00 |
| **Valor presente (meta)** | **R$ 604.833,33** |
| Recorrência gerada pelas vendas do mês | R$ 22.267/mês |
| Recorrência da carteira recebida no mês | R$ 107.014,26 |
| **Faturamento total do mês** | **R$ 711.847,59** |
| Carteira: parcelas pagas | 39 · R$ 143.514,25 |
| Carteira: parcelas pendentes | 38 · R$ 158.639,58 |
| Reuniões agendadas (pré-venda) | 205 |
| Reuniões realizadas | 158 |
| Taxa de presença | 84,0% |
| Conversão call → venda | 8,9% |

**Composição do valor presente por forma de pagamento:**

| | Valor | % |
|---|---|---|
| PIX / sinal (dinheiro no mês) | R$ 159.000 | 26% |
| Cartão 12x (contado cheio) | R$ 442.000 | 73% |
| 1ª parcela de recorrência | R$ 3.833 | 1% |

---

## 11. Pontos que ficaram em aberto

Levar para a gestão antes de codificar:

1. ⚠️ **A regra do percentual de comissão.** Não foi possível derivar dos dados. Varia
   por pessoa? Por produto? Por origem? Tem faixa por atingimento?
2. ⚠️ **O que significa `OTE` na prática.** Confirmado que é remuneração fixa, mas não
   se sabe se substitui totalmente a comissão ou complementa.
3. ⚠️ **A fórmula do painel "Mensalista"** da planilha não foi decifrada — o valor não
   reagiu a alterações nas linhas 74–78 e não corresponde a um `SUMIFS` simples das
   colunas `I` ou `J`. Pode estar congelada.
4. ⚠️ **Se a primeira parcela de uma recorrência entra no mês do fechamento** quando a
   venda tem entrada. Hoje não entra, mas o caso da Patrícia (boleto de 10x começando
   em julho ou agosto) está em aberto com o financeiro.
5. ⚠️ **Como unificar as duas carteiras** (comissões × financeiro), que hoje têm alunos
   e gateways diferentes.
6. ⚠️ **Contratos sem parcela definida** — ex.: `K = "3"` sem denominador, e vários
   contratos em `0/6` e `0/10` cuja cobrança nunca começou.

---

## Anexo — glossário

| Termo | Significado |
|---|---|
| **TCV** | Total Contract Value — valor cheio do contrato |
| **Valor presente** | o que conta no mês pelas 4 ressalvas; é a métrica da meta |
| **À vista** | na planilha: venda cujo valor entra cheio no mês (inclui 12x cartão) |
| **Mensalista** | na planilha: venda com entrada + recorrência, ou contrato antigo em parcelas |
| **D&F** | reunião de proposta feita pelo closer; **nunca** conta como agendamento de pré-venda |
| **Showed** | status do GHL para call realizada |
| **OTE** | On Target Earnings — remuneração variável fixa, sem comissão por venda |
| **SS** | Social Selling — time que prospecta pelo Instagram, base própria |
| **SDR** | pré-vendedor que trabalha os leads captados |
| **Farmer** | trabalha base antiga/inativa |
| **MQL** | lead qualificado por marketing (tag `mql` no GHL) |
