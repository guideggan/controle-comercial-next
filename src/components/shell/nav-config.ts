import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  LayoutDashboard,
  LineChart,
  Percent,
  Target,
  Users,
} from "lucide-react";

import type { Papel } from "@/server/auth/session";

// Configuração de navegação da sidebar (Fase 1.1 — app shell). Puramente
// declarativa: quem decide o que renderizar é o papel da sessão do
// servidor (nunca input do cliente), lido no layout que monta o shell.
//
// Rotas marcadas como `placeholder: true` ainda não têm tela própria — a
// fase que implementa a funcionalidade real substitui `href` e remove a
// flag, sem precisar tocar no restante da navegação.
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  placeholder?: boolean;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

const OPERACAO: NavSection = {
  label: "Operação",
  items: [
    { label: "Início", href: "/inicio", icon: LayoutDashboard },
    { label: "Vendas", href: "/vendas", icon: LineChart, placeholder: true },
    {
      label: "Comissões",
      href: "/comissoes",
      icon: Percent,
      placeholder: true,
    },
  ],
};

const ADMINISTRACAO: NavSection = {
  label: "Administração",
  items: [
    { label: "Colaboradores", href: "/colaboradores", icon: Users },
    { label: "Produtos", href: "/produtos", icon: Boxes },
    { label: "Metas", href: "/metas", icon: Target, placeholder: true },
  ],
};

const COLABORADOR_ENXUTO: NavSection = {
  label: "Operação",
  items: [{ label: "Meu Painel", href: "/painel", icon: LayoutDashboard }],
};

// Deriva as seções de navegação a partir do papel da sessão (nunca de
// input do cliente). ADMIN vê OPERAÇÃO + ADMINISTRAÇÃO; os demais papéis
// (CLOSER/SDR/SS) veem apenas o shell enxuto ("Meu Painel").
export function getNavSections(role: Papel): NavSection[] {
  if (role === "ADMIN") {
    return [OPERACAO, ADMINISTRACAO];
  }
  return [COLABORADOR_ENXUTO];
}
