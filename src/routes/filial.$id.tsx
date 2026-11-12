import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useErp, useSession } from "@/lib/erp";
import { useStock, materials, balanceOf, brl, getMaterial } from "@/lib/stock";
import { useOrders, statusLabels } from "@/lib/orders";

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

function FilialPage() {
  const { id } = Route.useParams();
  const s = useErp(); const ses = useSession(); const st = useStock(); const orders = useOrders();
  const b = s.branches.find(x => x.id === id);
  if (!b || !ses.visible.includes(id)) return <AppShell title="Filial" primaryAction={null}><div className="p-8 text-muted-foreground">Filial não encontrada ou sem acesso. <Link to="/filiais" className="text-primary">Voltar</Link></div></AppShell>;
  const value = st.balances.filter(x => x.clinicId === id).reduce((a, x) => a + x.qty * getMaterial(x.materialId).cost, 0);
  const users = s.users.filter(u => u.memberships.some(m => m.branchId === id));
  const myOrders = orders.filter(o => o.branchId === id || o.sourceId === id);
  return (
    <AppShell title={b.name} subtitle={`${b.code} · ${b.city}/${b.state} · Gestor: ${b.manager}`} primaryAction={null}>
      <div className="p-4 md:p-8 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 space-y-2 text-sm">
          <div className="font-semibold mb-2">Cadastro</div>
          {[["Razão social", b.legalName], ["CNPJ", b.cnpj], ["Endereço", b.address], ["Telefone", b.phone], ["E-mail", b.email], ["Centro de custo", b.costCenter], ["Região", b.region], ["Abertura", b.openedAt.split("-").reverse().join("/")]].map(([k, v]) => <div key={k} className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className="text-right">{v}</span></div>)}
          <div className="pt-3 font-semibold">Depósitos</div>
          {b.warehouses.map(w => <div key={w.id}><div className="font-medium">{w.name}</div><div className="text-xs text-muted-foreground">{w.locations.join(" · ") || "Sem localizações"}</div></div>)}
        </Card>
        <Card className="p-5 lg:col-span-2">
          <div className="flex justify-between mb-3"><div className="font-semibold">Estoque da filial</div><div className="text-sm text-muted-foreground">Valor: {brl(value)}</div></div>
          <div className="divide-y divide-border max-h-80 overflow-y-auto text-sm">
            {materials.map(m => { const q = balanceOf(st, m.id, id); return <div key={m.id} className="py-2 flex justify-between"><span>{m.name}</span><span className={q < m.min ? "text-warning font-medium" : "font-medium"}>{q} {m.unit}</span></div>; })}
          </div>
        </Card>
        <Card className="p-5">
          <div className="font-semibold mb-3">Usuários vinculados</div>
          {users.map(u => <div key={u.id} className="py-1.5 text-sm flex justify-between"><span>{u.name}</span><span className="text-muted-foreground">{s.roles.find(r => r.id === u.memberships.find(m => m.branchId === id)?.roleId)?.name}</span></div>)}
        </Card>
        <Card className="p-5 lg:col-span-2">
          <div className="font-semibold mb-3">Pedidos</div>
          {myOrders.length === 0 && <div className="text-sm text-muted-foreground">Nenhum pedido.</div>}
          {myOrders.map(o => <div key={o.id} className="py-2 flex justify-between text-sm border-b border-border"><span className="font-mono">{o.number}</span><Badge variant="outline">{statusLabels[o.status]}</Badge></div>)}
        </Card>
      </div>
    </AppShell>
  );
}
