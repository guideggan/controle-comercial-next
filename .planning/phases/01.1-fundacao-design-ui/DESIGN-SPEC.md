# Fase 1.1 — Fundação de Design (UI shell)

**Tipo:** INSERTED (feedback do usuário: telas da Fase 1 estavam sem estilo + bug de fonte serifada)
**Direção:** profissional limpo, tema claro. Espelhar o app de referência do usuário: **"DRE Consolidado / NEXT Ecommerce"**.

## Objetivo

Estabelecer o esqueleto visual (app shell) e o sistema de design que TODAS as telas das próximas fases vão herdar, corrigir os bugs de estilo do scaffold, e reestilizar as telas já existentes da Fase 1 (login, painel, colaboradores, produtos) no novo padrão.

## Bugs a corrigir (scaffold)

1. **Fonte serifada**: `src/app/globals.css` mapeia `--font-sans: var(--font-sans)` (circular/vazio) e o layout define `--font-geist-sans`. Corrigir para `--font-sans: var(--font-geist-sans)` (ou aplicar `font-sans` no body) para usar a Geist. Verificar também `--font-mono`.
2. **Título/idioma**: `src/app/layout.tsx` tem `metadata.title = "Create Next App"` e `<html lang="en">`. Trocar para título "Controle Comercial NEXT" e `lang="pt-BR"`.
3. Conferir se `@import "shadcn/tailwind.css"` em globals.css resolve; se quebrar o build de CSS, remover (as variáveis de tema já estão inline no `@theme`).

## App shell (espelhar a referência)

**Sidebar esquerda (fixa):**
- Topo: logo circular "NEXT" + nome do produto ("Controle Comercial") e subtítulo pequeno.
- Navegação agrupada por seções com rótulo em maiúsculo cinza e ícones (lucide-react). Item ativo destacado (fundo suave, texto forte).
  - Admin (papel ADMIN) vê: seção **OPERAÇÃO** (Início/Dashboard, Vendas [placeholder], Comissões [placeholder]) e seção **ADMINISTRAÇÃO** (Colaboradores, Produtos, Metas [placeholder]).
  - Colaborador (CLOSER/SDR/SS) vê shell enxuto: só **Meu Painel** (e futuramente Meu Extrato/Meus Agendamentos). SEM seção de administração.
- Rodapé da sidebar: avatar com iniciais + nome + papel do usuário logado; menu de "Sair".

**Topbar:**
- Breadcrumb (ex.: "Operação › Início").
- Título grande da página + subtítulo (ex.: "Indicadores de Julho de 2026").
- Área à direita para filtros (seletor de mês etc.) e botão preto primário quando aplicável.

**Conteúdo:**
- Cards brancos, borda suave, cantos arredondados (rounded-xl), sombra leve; rótulos de seção em cinza/maiúsculo/tracking.
- Preparar uso de **Recharts** para gráficos (linha/área) — pode incluir um gráfico de exemplo no dashboard/painel para validar o padrão.

**Design tokens:** tema claro, paleta neutra (zinc/slate) + **preto** como primário de destaque; usar as variáveis shadcn já presentes. Tipografia Geist (sans) já instalada.

## Telas a reestilizar (já existentes)

- `/login` — card centralizado, logo, layout limpo (sem sidebar).
- `/painel` (colaborador) — dentro do shell enxuto; cabeçalho com nome/papel; card(s) placeholder para meta/comissão (dados reais virão nas fases 6/8) — pode mostrar um gráfico de exemplo.
- `/colaboradores` (admin) — dentro do shell admin; tabela estilizada, botões e diálogos shadcn.
- `/produtos` (admin) — idem, tabela + form estilizados.

## Componentes shadcn a garantir/instalar

sidebar (ou construir manual), avatar, dropdown-menu, card, table, button, input, label, select, dialog/alert-dialog, badge, separator, sonner (já existe). Instalar via `npx shadcn@latest add ...` no estilo já configurado (base-nova / Base UI). Se algum componente não existir no registry para esse estilo, adaptar manualmente (como já foi feito com form.tsx).

## Critérios de aceite (verificação humana)

1. Nenhuma tela usa fonte serifada; visual condiz com "dashboard SaaS limpo".
2. Admin vê sidebar com seções OPERAÇÃO/ADMINISTRAÇÃO e navega entre Colaboradores/Produtos/Painel; item ativo destacado.
3. Colaborador (não-admin) vê shell enxuto sem menu de administração.
4. Login é uma tela limpa com card centralizado e a marca.
5. Perfil do usuário aparece no rodapé da sidebar; logout funciona.
6. Um gráfico Recharts renderiza corretamente (validação do padrão de gráficos).
7. Responsivo o suficiente para uso em telas menores (sidebar colapsável/– aceitável simples).
