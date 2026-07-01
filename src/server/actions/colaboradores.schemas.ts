import { Papel } from "@prisma/client";
import { z } from "zod";

// Schemas de validação da gestão de contas de colaborador (AUTH-05), isolados
// (sem "use server") pelo mesmo motivo de produtos.schemas.ts: um arquivo
// "use server" só pode exportar funções async.
export const criarColaboradorSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  email: z.string().trim().email("E-mail inválido"),
  papel: z.enum(Papel, { message: "Papel inválido" }),
  telefone: z.string().trim().optional().or(z.literal("")),
  pix: z.string().trim().optional().or(z.literal("")),
  senhaInicial: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
});

export const redefinirSenhaSchema = z.object({
  novaSenha: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
});

// Edição de colaborador (COLAB-01): mesmos campos de negócio do criar, MAS
// sem email nem senhaInicial. Email é a chave de login vinculada ao
// User.email do Better Auth (User.email é @unique e usado no signIn); editar
// o email do Colaborador aqui sem também trocar o User.email descasaria os
// dois registros, então essa troca fica fora de escopo nesta fase.
export const editarColaboradorSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  papel: z.enum(Papel, { message: "Papel inválido" }),
  telefone: z.string().trim().optional().or(z.literal("")),
  pix: z.string().trim().optional().or(z.literal("")),
});
