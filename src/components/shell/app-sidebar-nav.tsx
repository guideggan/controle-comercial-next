"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  LayoutDashboard,
  LineChart,
  Percent,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { NavIconKey, NavSection } from "@/components/shell/nav-config";

// Mapa chave -> componente de ícone. Vive no client component porque
// componentes/funções não atravessam a fronteira Server -> Client
// (nav-config.ts, que roda no server via getNavSections, só exporta a
// CHAVE serializável).
const ICONS: Record<NavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  vendas: LineChart,
  comissoes: Percent,
  colaboradores: Users,
  produtos: Boxes,
  metas: Target,
};

// Client component: precisa de usePathname() para destacar o item de
// navegação ativo. Os dados de navegação (quais seções/itens existem)
// continuam vindo do servidor via getNavSections(role) — este componente
// só decide ESTILO, nunca acesso.
export function AppSidebarNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6 px-3">
      {sections.map((section) => (
        <div key={section.label} className="flex flex-col gap-1">
          <span className="px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {section.label}
          </span>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = ICONS[item.icon];

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/70 hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.placeholder && !isActive && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                        em breve
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
