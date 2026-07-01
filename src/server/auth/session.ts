import "server-only";

import type { Papel } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth/auth";

// DAL de autorização server-only (AUTH-03/AUTH-04).
//
// TODO acesso a dados da aplicação — toda Server Action, toda leitura em RSC —
// passa primeiro por uma das funções abaixo. Este é o ÚNICO ponto de controle
// de "quem esta requisição pode ver"; CVE-2025-29927 provou que middleware
// sozinho não basta (ver 1-RESEARCH.md, Pitfall 1/CVE-2025-29927).
//
// Regra de ouro (Pitfall 1 — IDOR): nunca aceitar role/colaboradorId vindos do
// cliente (query param, form data, hidden field). O único colaboradorId
// confiável é o que vem da sessão, lido aqui.
//
// Papel reexportado do Prisma Client (fonte única do enum, definido em
// prisma/schema.prisma) para que consumidores deste módulo não precisem
// importar @prisma/client diretamente só para tipar um role.
export type { Papel };

type SessionUser = {
  role: Papel;
  colaboradorId: string;
};

// Lê a sessão atual via Better Auth. Server-only: depende de next/headers.
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

// Exige uma sessão válida. Sem sessão → redireciona para /login (UX; a
// restrição real de dados vive nas funções abaixo, não neste redirect).
export async function requireUser() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  // additionalFields do Better Auth (role, colaboradorId) — ver auth.ts e
  // 01-01-SUMMARY.md. Cast necessário pois o tipo base de session.user não
  // conhece os additionalFields estaticamente.
  return session.user as typeof session.user & SessionUser;
}

// Exige que a sessão tenha exatamente o role informado.
export async function requireRole(role: Papel) {
  const user = await requireUser();
  if (user.role !== role) {
    throw new Error("Forbidden: insufficient role");
  }
  return user;
}

// Coração de AUTH-03/AUTH-04: um colaborador só acessa os próprios dados;
// ADMIN acessa os dados de qualquer colaborador. O targetColaboradorId pode
// vir de input do cliente (ex.: param de rota) — por isso ele é sempre
// comparado contra o colaboradorId da sessão, nunca usado diretamente sem
// essa checagem.
export async function requireSelfOrAdmin(targetColaboradorId: string) {
  const user = await requireUser();
  if (user.role === "ADMIN") {
    return user;
  }
  if (user.colaboradorId !== targetColaboradorId) {
    throw new Error("Forbidden: cannot access another colaborador's data");
  }
  return user;
}
