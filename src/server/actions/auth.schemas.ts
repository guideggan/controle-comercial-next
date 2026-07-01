import { z } from "zod";

// Schema de validação do login, compartilhado entre o client component
// (login-form.tsx) e qualquer validação futura no servidor.
//
// Vive em um módulo separado (sem "use server") porque arquivos com a
// diretiva "use server" só podem exportar funções async (viram Server
// Actions) — um objeto zod exportado dali é adulterado pelo build do RSC.
export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
});
