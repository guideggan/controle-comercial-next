"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/server/auth/auth-client";
import { Button } from "@/components/ui/button";

// Botão de logout: usa authClient.signOut (limpa o cookie de sessão no
// navegador) e então navega para /login. Client component pois precisa do
// authClient (nunca importar src/server/auth/auth.ts aqui).
export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout} disabled={isPending}>
      {isPending ? "Saindo..." : "Sair"}
    </Button>
  );
}
