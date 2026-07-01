// Seed do admin inicial (rodado via `npx prisma db seed`, ver package.json).
//
// Sem este seed, ninguém consegue logar no sistema (o additionalField `role`
// do Better Auth tem defaultValue "SDR" — ver src/server/auth/auth.ts — então
// nenhum signup público resulta em ADMIN). Este script cria explicitamente o
// primeiro Colaborador ADMIN + conta de login vinculada.
//
// Idempotente: se já existir um Colaborador com papel ADMIN para o e-mail
// informado, o script não recria nada (seguro rodar de novo em deploy).
//
// NOTA — `--conditions=react-server` no comando do seed (package.json):
// este arquivo importa `@/server/auth/auth`, que começa com `import
// "server-only"`. Esse pacote sempre lança um erro ao ser importado, exceto
// quando resolvido sob a condition `react-server` (mapeada em
// node_modules/server-only/package.json#exports para um módulo vazio) — é
// assim que o bundler do Next.js normalmente neutraliza o import. Fora do
// Next (tsx puro), a condition precisa ser passada explicitamente.
import { auth } from "@/server/auth/auth";
import { db } from "@/lib/db";

const PRODUTOS_PADRAO = ["START", "PRO", "MASTER", "PADRAO", "Elite"];

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const nome = process.env.SEED_ADMIN_NOME || "Admin";

  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD são obrigatórios no .env para rodar o seed (senha nunca hardcoded no script).",
    );
  }

  const colaboradorExistente = await db.colaborador.findUnique({
    where: { email },
  });

  if (colaboradorExistente && colaboradorExistente.papel === "ADMIN") {
    console.log(
      `[seed] Colaborador ADMIN já existe para ${email} (id=${colaboradorExistente.id}) — nada a fazer.`,
    );
    return;
  }

  // Já existe um User (auth) para este e-mail? Então só falta vincular o
  // Colaborador ADMIN (idempotência em cima de uma execução parcial anterior).
  const userExistente = await db.user.findUnique({ where: { email } });

  if (userExistente) {
    const colaborador = await db.colaborador.upsert({
      where: { email },
      update: { papel: "ADMIN", ativo: true },
      create: { nome, email, papel: "ADMIN", ativo: true },
    });

    await db.user.update({
      where: { id: userExistente.id },
      data: { role: "ADMIN", colaboradorId: colaborador.id },
    });

    console.log(
      `[seed] User já existia para ${email} — vinculado a Colaborador ADMIN (id=${colaborador.id}) e role atualizado.`,
    );
    return;
  }

  // Cria a conta de login via Better Auth (auth.api.signUpEmail) para que a
  // senha passe pelo hashing interno do Better Auth (scrypt), nunca
  // reimplementado aqui. O additionalField `role` tem defaultValue "SDR"
  // (menor privilégio) — por isso o role é elevado para ADMIN logo em
  // seguida, num update direto via Prisma (nunca aceito como input do
  // signup).
  const signUpResult = await auth.api.signUpEmail({
    body: { email, password, name: nome },
  });

  if (!signUpResult?.user) {
    throw new Error(
      `[seed] auth.api.signUpEmail não retornou um usuário para ${email}.`,
    );
  }

  const colaborador = await db.colaborador.create({
    data: { nome, email, papel: "ADMIN", ativo: true },
  });

  await db.user.update({
    where: { id: signUpResult.user.id },
    data: { role: "ADMIN", colaboradorId: colaborador.id },
  });

  console.log(
    `[seed] Admin inicial criado: ${email} (colaboradorId=${colaborador.id}).`,
  );
}

async function seedProdutosPadrao() {
  for (const nomeProduto of PRODUTOS_PADRAO) {
    const existente = await db.produto.findFirst({
      where: { nome: nomeProduto },
    });
    if (existente) continue;

    await db.produto.create({ data: { nome: nomeProduto } });
    console.log(`[seed] Produto padrão criado: ${nomeProduto}`);
  }
}

async function main() {
  await seedAdmin();
  await seedProdutosPadrao();
}

main()
  .catch((error) => {
    console.error("[seed] Falhou:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
