import { notFound } from "next/navigation";

import { requireRole } from "@/server/auth/session";
import { getVenda } from "@/server/services/venda.service";
import { listarProdutos } from "@/server/repositories/produto.repo";
import { listarColaboradores } from "@/server/repositories/colaborador.repo";
import { formatarBRL } from "@/lib/format";
import { AppTopbar } from "@/components/shell/app-topbar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VendaForm } from "@/app/(admin)/vendas/venda-form";
import { ParcelaPagamentoForm } from "@/app/(admin)/vendas/[id]/parcela-pagamento-form";

// Data DATE pura vinda do Postgres (Prisma devolve `Date` em meia-noite
// UTC) — formata SEMPRE via getters UTC (nunca locais), mesma convenção de
// timezone-safety usada em vendas/page.tsx e plano-historico.tsx (Pitfall
// 6): usar getters locais poderia exibir o dia anterior dependendo do fuso
// do processo.
function formatarDataUTC(data: Date): string {
  const dia = String(data.getUTCDate()).padStart(2, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const ano = data.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatarMesAnoUTC(data: Date): string {
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const ano = data.getUTCFullYear();
  return `${mes}/${ano}`;
}

// "YYYY-MM-DDTHH:mm:ss.sssZ" -> "YYYY-MM-DD" puro, sem round-trip por
// `new Date(string)` — usado para popular o VendaForm em modo editar, que
// espera exatamente o mesmo formato de string do Zod (Pitfall 6).
function paraDataISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

const LABEL_TIPO_PARCELA: Record<string, string> = {
  ENTRADA: "Entrada",
  MENSALIDADE: "Mensalidade",
  AVISTA: "À vista",
};

export default async function VendaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");

  const { id } = await params;

  const venda = await getVenda(id);
  if (!venda) {
    notFound();
  }

  const [produtos, colaboradores] = await Promise.all([
    listarProdutos(),
    listarColaboradores(),
  ]);

  const produtosAtivos = produtos.filter((p) => p.ativo);
  const closers = colaboradores.filter((c) => c.ativo && c.papel === "CLOSER");
  const sdrs = colaboradores.filter(
    (c) => c.ativo && (c.papel === "SDR" || c.papel === "SS"),
  );

  // Total recebido nesta venda (PGTO-02 visível): soma simples das parcelas
  // já PAGAS — uma linha por parcela, sem dupla contagem. Não é o mesmo que
  // `recebidoNoMes` (que agrega entre vendas por competência, consumido nas
  // Fases 5/9); aqui é só o total desta venda específica.
  const totalRecebidoVenda = venda.parcelas
    .filter((p) => p.statusPagamento === "PAGO")
    .reduce((soma, p) => soma + Number(p.valorRecebido), 0);

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        breadcrumb={`Operação › Vendas › ${venda.alunoNome}`}
        title={venda.alunoNome}
        subtitle={`${venda.produto.nome} · ${formatarBRL(Number(venda.valorTotal))}`}
        actions={
          <VendaForm
            mode="editar"
            venda={{
              id: venda.id,
              dataVenda: paraDataISO(venda.dataVenda),
              alunoNome: venda.alunoNome,
              pagadorNome: venda.pagadorNome,
              plataforma: venda.plataforma,
              produtoId: venda.produtoId,
              tipoPagamento: venda.tipoPagamento,
              valorTotal: Number(venda.valorTotal),
              entrada: Number(venda.entrada),
              valorMensalidade: Number(venda.valorMensalidade),
              numeroParcelas: venda.numeroParcelas,
              diaVencimento: venda.diaVencimento,
              mesReferencia: paraDataISO(venda.mesReferencia),
              closerId: venda.closerId,
              sdrId: venda.sdrId,
              observacao: venda.observacao,
            }}
            bloqueado={venda.fechado}
            produtos={produtosAtivos}
            closers={closers}
            sdrs={sdrs}
          />
        }
      />

      <div className="flex-1 space-y-6 px-6 py-6">
        {venda.fechado && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Mês fechado — edição bloqueada.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Dados da venda</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Data da venda</p>
              <p className="text-sm font-medium">
                {formatarDataUTC(venda.dataVenda)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aluno</p>
              <p className="text-sm font-medium">{venda.alunoNome}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pagador</p>
              <p className="text-sm font-medium">{venda.pagadorNome}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plataforma</p>
              <Badge variant="outline">{venda.plataforma}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Produto</p>
              <p className="text-sm font-medium">{venda.produto.nome}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Tipo de pagamento
              </p>
              <Badge variant="outline">
                {venda.tipoPagamento === "A_VISTA" ? "À vista" : "Mensalista"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor total</p>
              <p className="text-sm font-medium">
                {formatarBRL(Number(venda.valorTotal))}
              </p>
            </div>
            {venda.tipoPagamento === "MENSALISTA" && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Entrada</p>
                  <p className="text-sm font-medium">
                    {formatarBRL(Number(venda.entrada))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Valor da mensalidade
                  </p>
                  <p className="text-sm font-medium">
                    {formatarBRL(Number(venda.valorMensalidade))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Número de parcelas
                  </p>
                  <p className="text-sm font-medium">
                    {venda.numeroParcelas}
                  </p>
                </div>
              </>
            )}
            <div>
              <p className="text-xs text-muted-foreground">
                Dia de vencimento
              </p>
              <p className="text-sm font-medium">{venda.diaVencimento}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Mês de referência
              </p>
              <p className="text-sm font-medium">
                {formatarMesAnoUTC(venda.mesReferencia)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Closer</p>
              <p className="text-sm font-medium">{venda.closer.nome}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">SDR</p>
              <p className="text-sm font-medium">
                {venda.sdr?.nome ?? "-"}
              </p>
            </div>
            {venda.observacao && (
              <div className="sm:col-span-3">
                <p className="text-xs text-muted-foreground">Observação</p>
                <p className="text-sm font-medium">{venda.observacao}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Parcelas geradas</CardTitle>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                Total recebido nesta venda
              </p>
              <p className="text-sm font-medium">
                {formatarBRL(totalRecebidoVenda)}
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor previsto</TableHead>
                  <TableHead>Valor recebido</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {venda.parcelas.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground"
                    >
                      Nenhuma parcela gerada.
                    </TableCell>
                  </TableRow>
                )}
                {venda.parcelas.map((parcela) => (
                  <TableRow key={parcela.id}>
                    <TableCell>{parcela.numero}</TableCell>
                    <TableCell>
                      {LABEL_TIPO_PARCELA[parcela.tipo] ?? parcela.tipo}
                    </TableCell>
                    <TableCell>
                      {formatarMesAnoUTC(parcela.mesReferencia)}
                    </TableCell>
                    <TableCell>
                      {formatarDataUTC(parcela.dataVencimento)}
                    </TableCell>
                    <TableCell>
                      {formatarBRL(Number(parcela.valorPrevisto))}
                    </TableCell>
                    <TableCell>
                      {parcela.statusPagamento === "PAGO"
                        ? formatarBRL(Number(parcela.valorRecebido))
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {parcela.statusPagamento === "PAGO" &&
                      parcela.dataPagamento
                        ? formatarDataUTC(parcela.dataPagamento)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          parcela.statusPagamento === "PAGO"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {parcela.statusPagamento === "PAGO"
                          ? "Pago"
                          : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ParcelaPagamentoForm
                        parcelaId={parcela.id}
                        valorPrevisto={Number(parcela.valorPrevisto)}
                        status={parcela.statusPagamento}
                        bloqueado={venda.fechado}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
