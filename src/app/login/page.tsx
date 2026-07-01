import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { LoginForm } from "./login-form";

// Tela de login (server component). Se já houver sessão válida, redireciona
// direto para /painel — evita mostrar o form a quem já está logado.
export default async function LoginPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session?.user) {
    redirect("/painel");
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary text-sm font-bold tracking-tight text-primary-foreground">
            NEXT
          </span>
          <div className="text-center">
            <p className="text-sm font-semibold">Controle Comercial</p>
            <p className="text-xs text-muted-foreground">NEXT Ecommerce</p>
          </div>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>
              Acesse com seu e-mail e senha cadastrados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
