import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadBranchDetail, type BranchDetail } from "@/lib/branches-live";

export const Route = createFileRoute("/filial/$id")({
  head: () => ({ meta: [
    { title: "Detalhes da Filial | Grupo Sorrisos" },
    { name: "description", content: "Estoque, pedidos, depósitos e usuários de uma filial do Grupo Sorrisos." },
    { property: "og:title", content: "Detalhes da Filial | Grupo Sorrisos" },
    { property: "og:description", content: "Visão completa de uma filial." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: FilialPage,
});

const orderLabel: Record<string, string> = {
  rascunho: "Rascunho", enviado: "Aguardando aprovação", correcao: "Correção solicitada", rejeitado: "Rejeitado",
  aprovado: "Aguardando separação", separacao: "Em separação", transporte: "Em transporte",
  recebido_parcial: "Parcialmente recebido", concluido: "Concluído", cancelado: "Cancelado",
};
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function FilialPage() {
  const { id } = Route.useParams();
  const [branch, setBranch] = useState<BranchDetail | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setMissing(false);
    void loadBranchDetail(id).then((next) => { if (!cancelled) setBranch(next); }).catch(() => { if (!cancelled) setMissing(true); });
    return () => { cancelled = true; };
  }, [id]);
  if (missing) return <AppShell title="Filial" primaryAction={null}><div className="p-8 text-muted-foreground">Filial não encontrada ou sem acesso. <Link to="/filiais" className="text-primary">Voltar</Link></div></AppShell>;
  if (!branch) return <AppShell title="Filial" primaryAction={null}><div className="p-8 text-muted-foreground">Carregando filial...</div></AppShell>;
  const stock = branch.stock.filter((item) => item.qty !== 0);
  return (
    <AppShell title={branch.name} subtitle={`${branch.code} · ${branch.city}/${branch.state} · Gestor: ${branch.manager || "não informado"}`} primaryAction={null}>
      <div className="p-4 md:p-8 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 space-y-2 text-sm">
          <div className="font-semibold mb-2">Cadastro</div>
          {[["Razão social", branch.legalName], ["CNPJ", branch.cnpj], ["Endereço", branch.address], ["Telefone", branch.phone], ["E-mail", branch.email], ["Centro de custo", branch.costCenter], ["Região", branch.region], ["Abertura", branch.openedAt.split("-").reverse().join("/")]].map(([k, v]) => <div key={k} className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className="text-right">{v || "—"}</span></div>)}
          <div className="pt-3 font-semibold">Depósitos</div>
          {branch.warehouses.map(w => <div key={w.id}><div className="font-medium">{w.name}</div><div className="text-xs text-muted-foreground">{w.locations.join(" · ") || "Sem localizações"}</div></div>)}
        </Card>
        <Card className="p-5 lg:col-span-2">
          <div className="flex justify-between mb-3"><div className="font-semibold">Estoque da filial</div><div className="text-sm text-muted-foreground">Valor: {money(branch.stockValue)}</div></div>
          <div className="divide-y divide-border max-h-80 overflow-y-auto text-sm">
            {stock.map(m => <div key={m.name} className="py-2 flex justify-between"><span>{m.name}</span><span className={m.qty < m.min ? "text-warning font-medium" : "font-medium"}>{m.qty} {m.unit}</span></div>)}
            {!stock.length && <div className="py-2 text-muted-foreground">Nenhum saldo nesta filial.</div>}
          </div>
        </Card>
        <Card className="p-5">
          <div className="font-semibold mb-3">Usuários vinculados</div>
          {branch.people.map(u => <div key={u.id} className="py-1.5 text-sm flex justify-between"><span>{u.name}</span><span className="text-muted-foreground">{u.role}</span></div>)}
          {!branch.people.length && <div className="text-sm text-muted-foreground">Nenhum usuário vinculado.</div>}
        </Card>
        <Card className="p-5 lg:col-span-2">
          <div className="font-semibold mb-3">Pedidos</div>
          {branch.orders.length === 0 && <div className="text-sm text-muted-foreground">Nenhum pedido.</div>}
          {branch.orders.map(o => <div key={o.id} className="py-2 flex justify-between text-sm border-b border-border"><span className="font-mono">{o.number}</span><Badge variant="outline">{orderLabel[o.status] ?? o.status}</Badge></div>)}
        </Card>
      </div>
    </AppShell>
  );
}
