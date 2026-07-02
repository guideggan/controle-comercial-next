import type { Papel } from "@/server/auth/session";

// Configuração de navegação da sidebar (Fase 1.1 — app shell). Puramente
// declarativa: quem decide o que renderizar é o papel da sessão do
// servidor (nunca input do cliente), lido no layout que monta o shell.
//
// `icon` é uma CHAVE (não o componente do lucide-react em si) porque
// getNavSections roda em Server Component e o resultado atravessa a
// fronteira para AppSidebarNav (Client Component, precisa de
// usePathname); componentes/funções não são serializáveis nessa
// fronteira ("Functions cannot be passed directly to Client Components").
// O client resolve a chave para o ícone real (ver ICONS em
// app-sidebar-nav.tsx).
//
// Rotas marcadas como `placeholder: true` ainda não têm tela própria — a
// fase que implementa a funcionalidade real substitui `href` e remove a
// flag, sem precisar tocar no restante da navegação.
export type NavIconKey =
  | "dashboard"
  | "vendas"
  | "comissoes"
  | "colaboradores"
  | "produtos"
  | "metas"
  | "agendamentos";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIconKey;
  placeholder?: boolean;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

const OPERACAO: NavSection = {
  label: "Operação",
  items: [
    { label: "Início", href: "/inicio", icon: "dashboard" },
    { label: "Vendas", href: "/vendas", icon: "vendas" },
    { label: "Comissões", href: "/comissoes", icon: "comissoes" },
    { label: "Agendamentos", href: "/agendamentos", icon: "agendamentos" },
  ],
};

const ADMINISTRACAO: NavSection = {
  label: "Administração",
  items: [
    { label: "Colaboradores", href: "/colaboradores", icon: "colaboradores" },
    { label: "Produtos", href: "/produtos", icon: "produtos" },
    { label: "Metas", href: "/metas", icon: "metas" },
  ],
};

const COLABORADOR_ENXUTO: NavSection = {
  label: "Operação",
  items: [{ label: "Meu Painel", href: "/painel", icon: "dashboard" }],
};

// Fase 7 (AGEND-01): SDR/SS ganham o item "Agendamentos" no shell enxuto,
// além de "Meu Painel" — CLOSER continua vendo só o painel (agendamento é
// responsabilidade de SDR/SS, não de closer).
const COLABORADOR_ENXUTO_SDR_SS: NavSection = {
  label: "Operação",
  items: [
    { label: "Meu Painel", href: "/painel", icon: "dashboard" },
    { label: "Agendamentos", href: "/agendamentos", icon: "agendamentos" },
  ],
};

// Deriva as seções de navegação a partir do papel da sessão (nunca de
// input do cliente). ADMIN vê OPERAÇÃO (com Agendamentos) + ADMINISTRAÇÃO;
// SDR/SS veem o shell enxuto + Agendamentos; CLOSER vê só o shell enxuto.
export function getNavSections(role: Papel): NavSection[] {
  if (role === "ADMIN") {
    return [OPERACAO, ADMINISTRACAO];
  }
  if (role === "SDR" || role === "SS") {
    return [COLABORADOR_ENXUTO_SDR_SS];
  }
  return [COLABORADOR_ENXUTO];
}
