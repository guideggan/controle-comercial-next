#!/usr/bin/env -S npx tsx
// ============================================================
// REDEFINIR SENHA DE LOGIN (suporte/recuperação de acesso)
// ============================================================
// Script standalone que redefine a senha de um usuário existente sem
// precisar de e-mail de reset (o sistema não tem envio de e-mail).
//
// A senha NUNCA é hasheada aqui à mão: o hash é gerado pelo próprio Better
// Auth (`ctx.password.hash`, scrypt) e gravado pelo internalAdapter — mesmo
// caminho que o signup usa. Reimplementar o hashing quebraria o login.
//
// NOTA — `--conditions=react-server`: este arquivo importa
// `@/server/auth/auth`, que começa com `import "server-only"` (ver a nota
// longa em prisma/seed.ts). Fora do Next, a condition precisa ser passada
// explicitamente na linha de comando.
//
// Uso (sempre da raiz do projeto):
//   npx tsx --conditions=react-server scripts/redefinir-senha.ts
//       -> diagnóstico: lista usuários, contas e vínculo com Colaborador
//
//   npx tsx --conditions=react-server scripts/redefinir-senha.ts \
//       --email alguem@next.com --senha "NovaSenha123!"
//       -> redefine a senha desse usuário
//
// Sem --email, usa SEED_ADMIN_EMAIL do .env.
import { auth } from "@/server/auth/auth";
import { db } from "@/lib/db";

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function diagnostico() {
  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, role: true, colaboradorId: true },
    orderBy: { email: "asc" },
  });

  console.log(`\n[diag] ${users.length} usuário(s) na tabela user:\n`);
  for (const u of users) {
    const contas = await db.account.findMany({
      where: { userId: u.id },
      select: { providerId: true, password: true },
    });
    const credencial = contas.find((c) => c.providerId === "credential");
    console.log(
      `  ${u.email}  role=${u.role}  colaborador=${u.colaboradorId ? "vinculado" : "SEM VÍNCULO"}  ` +
        `contas=[${contas.map((c) => c.providerId).join(", ") || "nenhuma"}]  ` +
        `senha=${credencial?.password ? "definida" : "AUSENTE"}`,
    );
  }

  const semUser = await db.colaborador.findMany({
    where: { user: { is: null } },
    select: { email: true, papel: true },
  });
  if (semUser.length > 0) {
    console.log(
      `\n[diag] Colaboradores sem conta de login: ${semUser
        .map((c) => `${c.email} (${c.papel})`)
        .join(", ")}`,
    );
  }
  console.log();
}

async function redefinir(email: string, novaSenha: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(
      `Nenhum usuário com e-mail ${email}. Rode sem --senha para ver quem existe.`,
    );
  }

  const ctx = await auth.$context;
  const hash = await ctx.password.hash(novaSenha);

  const credencial = await db.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });

  if (credencial) {
    // Caminho normal: já existe conta de credencial, só troca o hash.
    await ctx.internalAdapter.updatePassword(user.id, hash);
    console.log(`[ok] Senha redefinida para ${email}.`);
  } else {
    // O usuário existe mas nunca teve conta de e-mail/senha (ex.: criado
    // por um fluxo que não completou) — cria a conta de credencial.
    await db.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hash,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log(`[ok] Conta de credencial criada e senha definida para ${email}.`);
  }

  // Sessões antigas continuam válidas depois de uma troca de senha — revoga
  // todas para que a nova senha seja o único caminho de entrada.
  const { count } = await db.session.deleteMany({ where: { userId: user.id } });
  if (count > 0) console.log(`[ok] ${count} sessão(ões) ativa(s) revogada(s).`);
}

async function main() {
  const email = arg("email") || process.env.SEED_ADMIN_EMAIL;
  const senha = arg("senha");

  if (!senha) {
    await diagnostico();
    console.log(
      "Para redefinir:  npx tsx --conditions=react-server scripts/redefinir-senha.ts --email <e-mail> --senha <nova senha>\n",
    );
    return;
  }

  if (!email) {
    throw new Error("Informe --email (ou defina SEED_ADMIN_EMAIL no .env).");
  }
  if (senha.length < 8) {
    throw new Error("A senha precisa ter ao menos 8 caracteres (regra do Better Auth).");
  }

  await redefinir(email, senha);
}

main()
  .catch((error) => {
    console.error("[redefinir-senha] Falhou:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
