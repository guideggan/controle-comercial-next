import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// IMPORTANTE: este middleware é APENAS UX sugar (redirect grosseiro para
// quem não tem cookie de sessão nenhum). Ele NÃO é a fronteira de
// autorização da aplicação — CVE-2025-29927 provou que confiar só no
// middleware do Next.js para autorização é inseguro (middleware pode ser
// contornado). A autorização real vive no DAL (requireUser/requireRole/
// requireSelfOrAdmin em src/server/auth/session.ts), chamado no topo de
// cada layout/rota protegida no servidor.
//
// getSessionCookie apenas verifica a PRESENÇA do cookie (não valida a
// sessão contra o banco) — suficiente para o redirect de UX; a validação
// de verdade acontece em auth.api.getSession, dentro do DAL.
export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Cobre a rota protegida deste plano (/painel). Planos futuros que
// adicionarem subrotas em (admin) ou (colaborador) devem estender este
// matcher — o guard real, porém, é sempre o requireUser/requireRole no
// server component, não este middleware.
export const config = {
  matcher: ["/painel/:path*"],
};
