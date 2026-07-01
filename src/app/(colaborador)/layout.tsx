import { requireUser } from "@/server/auth/session";
import { AppShell } from "@/components/shell/app-shell";

// Layout do grupo (colaborador). Chama requireUser() no topo — sem sessão,
// o guard (DAL, src/server/auth/session.ts) redireciona para /login. Este é
// o ponto real de autorização da rota (não o middleware, que é só UX).
//
// Fase 1.1: monta o mesmo app shell do grupo (admin), porém a navegação
// derivada de getNavSections(role) para papéis não-ADMIN é o shell
// enxuto (só "Meu Painel", sem seção de administração).
export default async function ColaboradorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <AppShell role={user.role} nome={user.name}>
      {children}
    </AppShell>
  );
}
