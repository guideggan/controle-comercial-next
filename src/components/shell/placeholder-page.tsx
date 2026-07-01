import { Card, CardContent } from "@/components/ui/card";

// Stub visual para itens de navegação ainda sem tela própria (ex.: Vendas,
// Comissões, Metas). Fases futuras substituem a página inteira; este
// componente só existe para o item de sidebar não apontar para um 404.
export function PlaceholderPage({ titulo }: { titulo: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Em breve
        </p>
        <h2 className="text-lg font-semibold">{titulo}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Esta funcionalidade será implementada em uma fase futura do
          projeto.
        </p>
      </CardContent>
    </Card>
  );
}
