# Ajustes pós-testes do usuário (2026-07-02) — v1.1

Conjunto de mudanças pedido pelo usuário após testar o app. Executar APÓS a passada de performance (evitar conflito de arquivos). Sequência: (A) migrações de schema, (B) config/dados, (C) features.

## Decisões confirmadas
- Limpar vendas: **apenas mês de referência Julho** (manter histórico Jan–Jun importado).
- Social Seller: **um único colaborador "Time SS"** (meta/comissão do time).
- Usuário **"Outros"**: placeholder de origem (usável como closer/SDR quando vem de fora/outro SDR, **sem comissão**).
- Meta da **Paola: PENDENTE** (usuário vai informar).

## A. Migrações de schema
1. `Produto`: adicionar `categoria` (enum ou string) — categorias: ACELERACAO_MENTORIA, IMERSAO_PRESENCIAL, EVENTO_PRESENCIAL.
2. `Venda`: adicionar `statusAprovacao` (PENDENTE_APROVACAO | APROVADA | REJEITADA), `aprovadaPorId`/`aprovadaEm` (opcional), e `linkCrm` (string, obrigatório quando criada por closer).
3. `ComissaoApurada` (ou apuração): adicionar `observacao` (texto) por pessoa/mês, editável no fechamento.
4. (Se necessário) suporte a exclusão/arquivamento de `Colaborador`.

## B. Config / dados
5. **Colaboradores**: remover os 20 importados; deixar só:
   - Closers: Yuri, Paola, Pedro, Douglas, Roberta
   - SDR: João Pedro, Bruna, José
   - Time SS (colaborador único)
   - Outros (placeholder de origem, sem comissão)
6. **Metas (mês corrente)**: Pedro=233333, Douglas=233333, Roberta=233333, Yuri=650000, João Pedro=50, Bruna=45, José=40, Time SS=55, Paola=PENDENTE. (Closers em R$; SDR/SS em nº de reuniões realizadas.)
7. **Produtos**: limpar tudo e criar:
   - Programas de aceleração e mentoria: Mentoria Elite, Mentoria Pro, Mentoria Master
   - Programa de imersão presencial: Next Track
   - Eventos presenciais: Next Experience, Tiktok Day
8. **Limpar vendas de Julho** (e parcelas/apurações vinculadas) — manter Jan–Jun.

## C. Features / comportamento
9. **Meta de SDR/SS = reuniões REALIZADAS** (não agendadas): ajustar rótulo/medida; realizado já usa contagem de REALIZADO. Renomear "agendamentos" → "reuniões" na terminologia de meta/painel do SDR/SS.
10. **Excluir/arquivar colaborador** fácil (equipe tem ~8 pessoas): ação de excluir (ou desativar+ocultar) na lista de colaboradores.
11. **Closer cadastra venda com aprovação do admin**: closer pode criar venda (entra PENDENTE_APROVACAO); admin aprova/rejeita; só conta (receita/comissão) após aprovada. Ajustar telas (closer vê "Nova venda"; admin vê fila de aprovação).
12. **Link do CRM obrigatório** na venda criada pelo closer (campo `linkCrm`).
13. **Comissão editável por colaborador**: já suportado (plano por pessoa, versionado). Usuário vai passar as condições específicas de cada um depois.

## Pendências do usuário
- Meta da Paola.
- Condições de pagamento/comissão específicas de cada colaborador.
