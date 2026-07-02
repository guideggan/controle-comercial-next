---
phase: 10-importacao-do-historico
plan: única sessão (execução lean, sem PLAN.md formal)
subsystem: importação de histórico (script standalone)
tags: [import, xlsx, reconciliacao, idempotencia, historico]
requires: [05 (motor de comissão), 06 (metas), 07 (agendamentos), 09 (dashboard do gestor)]
provides: [histórico de vendas/parcelas/comissão carregado no Neon real]
affects: []
tech-stack:
  added: [xlsx@0.18.5 (SheetJS, leitura de .xlsx)]
  patterns:
    - "import/ é um script tsx standalone (NÃO web runtime) — reusa src/domain/vendas/parcelas.ts, src/domain/comissao/money.ts e fala com @prisma/client diretamente (mesmo padrão de prisma/seed.ts), nunca reimplementando cronograma ou arredondamento"
    - "Pipeline em 3 módulos puros testáveis: normalizacao.ts (parse/normalização de uma linha bruta, 38 testes), reconciliacao.ts (recomputo + comparação vs. planilha, 11 testes), planilha.ts (leitura SheetJS/mapeamento de colunas por nome, não posição)"
    - "Chave natural da venda (alunoNome+dataVenda+valorTotal) mapeia para MÚLTIPLAS linhas da planilha (a mesma venda aparece em várias abas mensais, uma por mês com movimento de pagamento) — o importador AGRUPA por chave natural antes de gravar, fundindo o fato de pagamento de todas as linhas do grupo num único cronograma de parcelas, nunca perdendo meses pagos de linhas processadas antes"
    - "Recomputação de comissão histórica = valorRecebidoNoMes (FÓRMULA da planilha, ou inferido de VALOR TOTAL/MENSALIDADE quando a aba não tem coluna FÓRMULA) × percentual histórico da PRÓPRIA linha — nunca a coluna COMISSÃO CLOSER/SDR da planilha (Pitfall 9)"
key-files:
  created:
    - import/normalizacao.ts
    - import/normalizacao.test.ts
    - import/planilha.ts
    - import/reconciliacao.ts
    - import/reconciliacao.test.ts
    - import/importar-historico.ts
  modified:
    - package.json (script "import", dependência xlsx)
    - vitest.config.ts (include "import/**/*.test.ts")
    - .gitignore (import/.output/ — relatórios contêm PII, nunca versionar)
decisions:
  - "Escopo reduzido deliberadamente: só 'Comissões_Vendas - NEXT.xlsx' é importado (IMPORT-01). 'Desempenho Time - NEXT (1).xlsx' (metas/agendamentos históricos) tem layout de blocos livres separados por linhas em branco, formatos de data inconsistentes entre pessoas/semanas — não é machine-parseable com confiança suficiente no orçamento desta fase. Metas/agendamentos passam a ser rastreados a partir de hoje (Fases 6/7 já funcionam), histórico dessas duas áreas não foi retroativamente carregado."
  - "Só as 13 abas mensais 'PGTO' de layout padrão são processadas; 'Deshboard', 'IMERSÃOPGTO JULHO', 'PIX IMERSÃO' e as 2 abas FINANCEIRO (tracking de lead/conciliação contábil, fora do domínio do produto) são explicitamente puladas e listadas no relatório, nunca lidas silenciosamente."
  - "Achado real (descoberto rodando --apply contra o Neon): a MESMA venda aparece repetida em várias abas mensais — cada aba representa o status de pagamento daquela venda NAQUELE mês específico, não vendas distintas. O importador agrupa por chave natural (aluno+data+valorTotal) ANTES de gravar, fundindo os fatos de pagamento de TODAS as linhas do grupo — a primeira versão (linha a linha) sobrescrevia/perdia meses pagos de linhas anteriores do mesmo grupo; corrigido e validado (2 execuções --apply consecutivas produziram exatamente os mesmos 261 registros de venda)."
  - "COMISSÃO CLOSER/SDR da planilha NUNCA é copiada como comissão final — sempre recomputada como valorRecebidoNoMes × percentual histórico da linha, com o helper de arredondamento único do motor real (src/domain/comissao/money.ts). Divergências (37/65 combinações mês+pessoa) são majoritariamente linhas 'Pendente' que ainda carregam uma comissão pré-calculada na planilha (violação de PGTO-03 na própria origem) — tratado como achado a investigar, documentado no relatório, nunca 'corrigido' silenciosamente copiando o valor da planilha."
  - "Limitação de schema herdada da Fase 5 (não introduzida por esta fase): comissao_apurada é 1 linha por (colaborador, mês) — 7 colaboradores que atuaram como CLOSER e SDR em vendas diferentes no mesmo mês têm só uma linha de apuração histórica gravada (a última role processada), mesma limitação que afetaria dados cadastrados manualmente nesse cenário."
  - "Colaboradores importados sem e-mail real na planilha recebem e-mail sintético determinístico ({nome-slug}@import.historico.local) — permite login futuro após redefinição de senha pelo admin, documentado explicitamente."
metrics:
  duration_min: 90
  completed: 2026-07-02
---

# Phase 10: Importação do Histórico — Summary

Script standalone (`import/importar-historico.ts`, tsx + SheetJS) importou o histórico real de "Comissões_Vendas - NEXT.xlsx" para o Neon de produção: 20 colaboradores, 14 produtos, 261 vendas, 1.454 parcelas (304 pagas) e 58 snapshots de comissão apurada, com a comissão SEMPRE recomputada a partir dos fatos brutos (valor recebido × % histórico da linha) e reconciliada contra os valores da própria planilha — nunca copiando a coluna COMISSÃO/FÓRMULA cegamente (Pitfall 9).

## O que foi construído

**`import/normalizacao.ts`** (38 testes): módulo puro que normaliza uma linha bruta da planilha em fatos de venda — parsing de datas (Date/string ISO/BR), números pt-BR, percentuais com placeholders ("OTE", "A Definir", "-"), mapeamento de plataforma/tipo de pagamento, detecção de nomes-de-pessoa vs. rótulos de categoria (SS/IMERSÃO/RENOVAÇÃO/INDICAÇÃO/UPGRADE/OUTBOUND não viram Colaborador fantasma), inferência de ano do "MÊS DE REFERÊNCIA" (só nome do mês, sem ano) a partir da data da linha, e — achado real durante os primeiros dry-runs — inferência de `valorRecebidoNoMes` a partir de VALOR TOTAL/MENSALIDADE quando a aba não tem coluna FÓRMULA (2 das 13 abas mensais).

**`import/planilha.ts`**: camada SheetJS (`cellDates: true`) — mapeia colunas por NOME de cabeçalho normalizado (não posição fixa, pois o layout varia levemente entre abas), com fallback posicional para uma aba real com cabeçalho da coluna A vazio; detecta o marcador de rodapé/totais ("RECEITA GERADA", "TOTAL COMISSÕES...") varrendo a linha inteira, não só a coluna esperada.

**`import/reconciliacao.ts`** (11 testes): recomputa comissão por linha usando o MESMO helper de arredondamento do motor real (`src/domain/comissao/money.ts`), compara contra a coluna COMISSÃO CLOSER/SDR da própria linha (tolerância R$0,05) e agrega por (mês, pessoa, papel) para o relatório final.

**`import/importar-historico.ts`**: orquestrador — parse (13 abas mensais reconhecidas, 5 abas fora de escopo listadas explicitamente) → validação/dry-run (relatório completo, TODAS as rejeições e divergências, sem truncar) → carga idempotente por chave natural. Flags `npm run import` (dry-run) e `npm run import -- --apply` (grava). Relatório sempre salvo em `import/.output/` (gitignored, PII).

## Achado real corrigido durante a execução (Rule 1)

Rodando `--apply` pela primeira vez contra o Neon, o número de vendas gravadas (94→104, estagnado) divergia muito do contador em memória do script (693 "criadas"). Investigação revelou que a MESMA venda aparece repetida em várias abas mensais da planilha (uma linha por mês em que teve movimento de pagamento) — processar linha a linha fazia cada linha subsequente sobrescrever/perder os meses pagos das linhas anteriores da mesma venda. Corrigido agrupando por chave natural (aluno+data+valorTotal) ANTES de gravar, fundindo os fatos de pagamento de TODO o grupo num único cronograma de parcelas. Validado rodando `--apply` duas vezes consecutivas: ambas produziram exatamente 261 vendas (idempotência confirmada, IMPORT-03).

## Reconciliação (IMPORT-02)

28 de 65 combinações (mês, pessoa, papel) batem exatamente (diferença R$0,00) entre o total recomputado e o total somado das linhas da própria planilha. As 37 divergentes são majoritariamente explicadas por um padrão real na origem: linhas com STATUS="Pendente" que ainda carregam uma COMISSÃO CLOSER/SDR pré-calculada na planilha (ex.: venda pendente com comissão "90" na coluna, mas o motor corretamente zera por PGTO-03 — pendente conta como zero). Isso é tratado como um achado a investigar na planilha original, não uma falha do importador — o relatório completo (`import/.output/relatorio-importacao-apply-*.txt`, gitignored) lista TODAS as divergências linha a linha com aba/linha/aluno/valores, nunca trunca nem descarta silenciosamente.

## Escopo explicitamente reduzido

"Desempenho Time - NEXT (1).xlsx" (metas semanais + agendamentos SDR/SS) **não foi importado**: seu layout é blocos livres de largura variável separados por linhas em branco, com formatos de data/coluna inconsistentes por pessoa e por semana (ex.: `"01/01 até 11/01"` vs. `datetime` vs. `"01 até 7"`), sem uma estrutura tabular única confiável para parsing automático no orçamento desta fase. Metas e agendamentos passam a ser rastreados a partir de hoje (Fases 6/7, já funcionais); o histórico dessas duas áreas específicas não foi retroativamente carregado.

## Verificação

Dados verificados fluindo pelas MESMAS funções de service/repo que a UI usa (`listarVendas`, `recebidoNoMes`, `getApuracao`) — não uma leitura direta da tabela. Contagens finais no Neon: 20 colaboradores, 14 produtos, 261 vendas, 1.454 parcelas (304 pagas), 58 apurações históricas, 19 planos de comissão (percentual_fixo, best-effort a partir do % mais frequente observado por colaborador). Nenhum dado de planilha (.xlsx) nem relatório de reconciliação foi commitado (gitignored).

## Gate final

tsc: limpo. vitest: 156/156 passando (49 novos testes de `normalizacao.ts`/`reconciliacao.ts`, nenhum teste anterior quebrado). `next build`: 0 erros.

## Requisitos

IMPORT-01, IMPORT-02, IMPORT-03 — completos.
