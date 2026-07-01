import { requireUser } from "@/server/auth/session";

// Placeholder da rota /painel — PROVA que a rota é protegida e self-scoped
// via guard server-side (requireUser), não apenas pelo middleware (ver
// src/middleware.ts e o comentário sobre CVE-2025-29927).
//
// Fase 8 (Dashboard do Colaborador) substitui este placeholder por dados
// reais lidos sempre através de requireSelfOrAdmin(colaboradorId), nunca
// confiando em um colaboradorId vindo do cliente.
export default async function PainelPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-lg font-semibold">Painel de {user.name}</h1>
      <p className="text-sm text-muted-foreground">Papel: {user.role}</p>
      <p className="text-sm text-muted-foreground">
        Colaborador ID: {user.colaboradorId ?? "(nenhum vinculado)"}
      </p>
    </div>
  );
}
