"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth/auth";

// Server action de logout: encerra a sessão no servidor (revoga o registro
// em Session) e redireciona para /login. Usada pelo botão de logout no
// header do grupo (colaborador)/(admin).
export async function logoutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
