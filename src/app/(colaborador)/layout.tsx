import { requireUser } from "@/server/auth/session";
import { Badge } from "@/components/ui/badge";

import { LogoutButton } from "./logout-button";

// Layout do grupo (colaborador). Chama requireUser() no topo — sem sessão,
// o guard (DAL, src/server/auth/session.ts) redireciona para /login. Este é
// o ponto real de autorização da rota (não o middleware, que é só UX).
export default async function ColaboradorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{user.name}</span>
          <Badge variant="secondary">{user.role}</Badge>
        </div>
        <LogoutButton />
      </header>
      <main className="flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
