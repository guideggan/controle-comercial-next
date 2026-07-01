import type { ReactNode } from "react";

// Topbar do app shell: breadcrumb + título grande + subtítulo, com uma
// área à direita reservada para filtros/ações (ex.: seletor de mês,
// botão preto primário). `actions` é opcional — nem toda tela precisa.
export function AppTopbar({
  breadcrumb,
  title,
  subtitle,
  actions,
}: {
  breadcrumb?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b bg-background px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        {breadcrumb && (
          <p className="text-xs font-medium text-muted-foreground">
            {breadcrumb}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
