"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { loginSchema } from "@/server/actions/auth.schemas";
import { authClient } from "@/server/auth/auth-client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { z } from "zod";

type LoginValues = z.infer<typeof loginSchema>;

// Client component: formulário de login por e-mail/senha (AUTH-01).
// Usa authClient.signIn.email (nunca uma server action) para que o Better
// Auth sete os cookies de sessão corretamente no navegador.
export function LoginForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setIsSubmitting(true);
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    setIsSubmitting(false);

    if (error) {
      // Nunca expor detalhes do erro do servidor ao usuário final.
      toast.error("E-mail ou senha incorretos");
      return;
    }

    router.push("/painel");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl
                render={
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="voce@empresa.com"
                    {...field}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Senha</FormLabel>
              <FormControl
                render={
                  <Input
                    type="password"
                    autoComplete="current-password"
                    {...field}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? "Entrando..." : "Entrar na conta"}
        </Button>
      </form>
    </Form>
  );
}
