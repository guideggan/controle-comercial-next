"use server";

import { revalidatePath } from "next/cache";
import { hashPassword } from "better-auth/crypto";

import { requireRole } from "@/server/auth/session";
import { auth } from "@/server/auth/auth";
import { db } from "@/lib/db";
import {
  atualizarColaboradorRow,
  criarColaboradorRow,
  getColaborador,
  setColaboradorAtivo,
} from "@/server/repositories/colaborador.repo";
import {
  criarColaboradorSchema,
  editarColaboradorSchema,
  redefinirSenhaSchema,
} from "@/server/actions/colaboradores.schemas";

// Server actions da gestão administrativa de contas de colaborador (AUTH-05).
// Cada action começa com requireRole("ADMIN") — nenhuma escrita acontece
// antes dessa checagem (mesmo padrão de produtos.actions.ts).
//
// Decisão de API do Better Auth (doc-check better-auth.com/docs/plugins/admin
// e better-auth.com/docs/adapters/prisma, Open Question 1 do research): NÃO
// usamos o plugin `better-auth/plugins/admin`. Esse plugin define seu próprio
// campo `role` (schema.user.role, sem defaultValue) e seu próprio esquema de
// autorização (hasPermission comparando contra adminRoles, default "admin"
// minúsculo) — colidiria com o additionalField `role` já tipado como Papel
// (ADMIN/CLOSER/SDR/SS) e com o requireRole("ADMIN") que já é a fronteira de
// autorização deste projeto. Em vez disso: `auth.api.signUpEmail` (mesmo
// caminho de hashing do signup normal, reusado pelo seed) para criar a conta,
// e `hashPassword` de `better-auth/crypto` + update direto via Prisma no
// Account (providerId "credential") para redefinir senha — os endpoints
// nativos `setPassword`/`changePassword` do core exigem sessão do próprio
// usuário (sensitiveSessionMiddleware) e por isso não servem para um admin
// redefinir a senha de outra pessoa.
//
// Sem transação Prisma cruzando Better Auth + Colaborador: auth.api.signUpEmail
// usa o PrismaClient interno passado ao prismaAdapter em auth.ts, que não
// participa de um db.$transaction aberto aqui. Por isso: cria-se o
// Colaborador primeiro, cria-se o User via Better Auth, vincula-se os dois;
// se qualquer etapa após a criação do Colaborador falhar, o Colaborador
// órfão é removido (rollback manual) para não deixar lixo sem conta de login.
export async function criarColaborador(input: {
  nome: string;
  email: string;
  papel: string;
  telefone?: string;
  pix?: string;
  senhaInicial: string;
}) {
  await requireRole("ADMIN");

  const parsed = criarColaboradorSchema.parse(input);

  const colaborador = await criarColaboradorRow(db, {
    nome: parsed.nome,
    email: parsed.email,
    papel: parsed.papel,
    telefone: parsed.telefone || undefined,
    pix: parsed.pix || undefined,
  });

  try {
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: parsed.email,
        password: parsed.senhaInicial,
        name: parsed.nome,
      },
    });

    if (!signUpResult?.user) {
      throw new Error(
        "auth.api.signUpEmail não retornou um usuário ao criar colaborador.",
      );
    }

    await db.user.update({
      where: { id: signUpResult.user.id },
      data: { role: parsed.papel, colaboradorId: colaborador.id },
    });
  } catch (error) {
    // Rollback manual: sem conta de login, o Colaborador ficaria órfão.
    await db.colaborador.delete({ where: { id: colaborador.id } });
    throw error;
  }

  revalidatePath("/colaboradores");
}

// Fecha o COLAB-01: hoje só existia criar/desativar/redefinir senha; esta
// action adiciona o caminho de edição de nome/papel/telefone/pix de um
// colaborador já existente. Email não é editável aqui (ver comentário em
// editarColaboradorSchema).
export async function editarColaborador(
  id: string,
  input: { nome: string; papel: string; telefone?: string; pix?: string },
) {
  await requireRole("ADMIN");

  const parsed = editarColaboradorSchema.parse(input);

  const colaborador = await getColaborador(id);
  if (!colaborador) {
    throw new Error("Colaborador não encontrado");
  }

  await atualizarColaboradorRow(id, {
    nome: parsed.nome,
    papel: parsed.papel,
    telefone: parsed.telefone || undefined,
    pix: parsed.pix || undefined,
  });

  // Mantém o User do Better Auth (fonte da sessão/exibição de nome no shell)
  // coerente com o Colaborador (fonte de negócio) após a edição. Não é
  // estritamente exigido pelo COLAB-01, mas evita nome/papel divergentes
  // entre a sessão logada e a listagem de colaboradores.
  if (colaborador.user?.id) {
    await db.user.update({
      where: { id: colaborador.user.id },
      data: { name: parsed.nome, role: parsed.papel },
    });
  }

  revalidatePath("/colaboradores");
  revalidatePath(`/colaboradores/${id}`);
}

export async function desativarColaborador(id: string) {
  await requireRole("ADMIN");

  const colaborador = await getColaborador(id);
  if (!colaborador) {
    throw new Error("Colaborador não encontrado");
  }

  await setColaboradorAtivo(id, false);

  // Revoga a sessão logada do usuário vinculado: os endpoints nativos de
  // revogação do Better Auth (revokeSessions/revokeUserSessions do plugin
  // admin) exigem sessão própria ou o plugin admin (ver nota acima), então a
  // revogação é feita direto na tabela Session (sessão de banco, revogável —
  // ver auth.ts) para que o próximo request do colaborador desativado caia
  // sem sessão válida.
  if (colaborador.user?.id) {
    await db.session.deleteMany({ where: { userId: colaborador.user.id } });
  }

  revalidatePath("/colaboradores");
}

export async function redefinirSenha(colaboradorId: string, novaSenha: string) {
  await requireRole("ADMIN");

  const parsed = redefinirSenhaSchema.parse({ novaSenha });

  const colaborador = await getColaborador(colaboradorId);
  if (!colaborador?.user?.id) {
    throw new Error("Colaborador sem conta de login vinculada");
  }

  // Mesmo hashing (scrypt) usado pelo login/signup do Better Auth — nunca
  // reimplementado aqui, só reutilizado via better-auth/crypto.
  const passwordHash = await hashPassword(parsed.novaSenha);

  await db.account.updateMany({
    where: { userId: colaborador.user.id, providerId: "credential" },
    data: { password: passwordHash },
  });

  // Revoga sessões existentes para que a senha antiga (e a sessão aberta com
  // ela) deixe de valer imediatamente após a redefinição.
  await db.session.deleteMany({ where: { userId: colaborador.user.id } });

  revalidatePath("/colaboradores");
}
