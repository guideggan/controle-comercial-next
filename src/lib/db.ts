import { PrismaClient } from "@prisma/client";

// Singleton clássico do Prisma 6 (sem driver adapter, sem prisma.config.ts).
// Evita esgotar conexões em dev com o hot-reload do Next.js recriando o
// PrismaClient a cada mudança de arquivo.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
