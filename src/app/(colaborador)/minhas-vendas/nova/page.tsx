import { requireUser } from "@/server/auth/session";
import { listarProdutos } from "@/server/repositories/produto.repo";
import { listarColaboradores } from "@/server/repositories/colaborador.repo";
import { AppTopbar } from "@/components/shell/app-topbar";
import { Card } from "@/components/ui/card";

import { NovaVendaCloserForm } from "@/app/(colaborador)/minhas-vendas/nova/nova-venda-closer-form";

// Cadastro de venda pelo CLOSER (v1.1, VENDA-11/12): reusa criarVendaAction
// (o service decide PENDENTE_APROVACAO a partir do role real da sessão,
// nunca do client) com linkCrm OBRIGATÓRIO. Só CLOSER acessa esta rota —
// qualquer outro papel é barrado aqui mesmo (o layout (colaborador) só
// garante sessão, não papel).
export default async function NovaVendaPage() {
  const user = await requireUser();

  if (user.role !== "CLOSER") {
    return (
      <div className="flex flex-1 flex-col">
        <AppTopbar breadcrumb="Operação › Nova venda" title="Nova venda" />
        <div className="flex-1 px-6 py-6">
          <Card className="px-6 py-4 text-sm text-muted-foreground">
            Esta tela é exclusiva para closers.
          </Card>
        </div>
      </div>
    );
  }

  const [produtos, colaboradores] = await Promise.all([
    listarProdutos(),
    listarColaboradores(),
  ]);

  const produtosAtivos = produtos.filter((p) => p.ativo);
  const sdrs = colaboradores.filter(
    (c) => c.ativo && (c.papel === "SDR" || c.papel === "SS"),
  );

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb="Operação › Nova venda"
        title="Nova venda"
        subtitle="A venda entra em análise do admin antes de contar em comissão/dashboard."
      />

      <div className="flex-1 px-6 py-6">
        <Card className="max-w-3xl p-6">
          <NovaVendaCloserForm
            produtos={produtosAtivos}
            sdrs={sdrs}
            closerId={user.colaboradorId}
          />
        </Card>
      </div>
    </div>
  );
}
