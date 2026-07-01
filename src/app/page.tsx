import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 text-center dark:bg-black">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Controle Comercial NEXT
        </h1>
        <p className="max-w-md text-muted-foreground">
          Metas, vendas e comissões em um só lugar. Faça login para
          continuar.
        </p>
      </div>
      <Button render={<Link href="/login">Entrar</Link>} />
    </div>
  );
}
