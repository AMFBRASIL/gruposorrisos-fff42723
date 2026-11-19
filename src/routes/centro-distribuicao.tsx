import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StockStat } from "@/components/stock-ui";
import { OrderSheet } from "@/components/order-dialogs";
import { useProcurementErp as useErp, useProcurementSession as useSession, branchName, useOrders, statusLabels, saveDraft, actions } from "@/lib/procurement-live";
import { useStock, materials, balanceOf } from "@/lib/stock-live";
import { PackageOpen, Truck, Hourglass, RefreshCcw } from "lucide-react";

export const Route = createFileRoute("/centro-distribuicao")({
  head: () => ({ meta: [
    { title: "Centro de Distribuição | Grupo Sorrisos" },
    { name: "description", content: "Fila de separação e expedição do centro de distribuição e sugestões de reposição das filiais." },
    { property: "og:title", content: "Centro de Distribuição | Grupo Sorrisos" },
    { property: "og:description", content: "Separação, expedição e reposição automática." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CdPage,
});

function CdPage() {
  const orders = useOrders(); const ses = useSession(); const st = useStock(); const erp = useErp();
  const [openId, setOpenId] = useState<string | null>(null);
  const toPick = orders.filter(o => o.status === "aprovado"); const picking = orders.filter(o => o.status === "separacao"); const transit = orders.filter(o => o.status === "transporte");
  const clinics = erp.branches.filter(b => b.type === "clinica" && b.active && ses.scope.includes(b.id));
  const suggestions = clinics.map(b => ({ b, items: materials.filter(m => balanceOf(st, m.id, b.id) < m.min).map(m => ({ materialId: m.id, requested: m.max - balanceOf(st, m.id, b.id) })) })).filter(x => x.items.length);
  const Queue = ({ title, list }: { title: string; list: typeof orders }) => (
    <Card className="p-4"><div className="font-semibold mb-3">{title} <span className="text-muted-foreground font-normal">({list.length})</span></div>
      <div className="space-y-2">{list.length === 0 && <div className="text-sm text-muted-foreground">Vazio.</div>}{list.map(o => <button key={o.id} onClick={() => setOpenId(o.id)} className="w-full text-left rounded-md border border-border p-3 hover:border-primary/40">
        <div className="flex justify-between text-sm"><span className="font-mono">{o.number}</span><Badge variant="outline" className="capitalize">{o.priority}</Badge></div>
        <div className="text-xs text-muted-foreground">{branchName(o.branchId)} · {o.items.length} itens · {statusLabels[o.status]}</div></button>)}</div>
    </Card>
  );
  return (
    <AppShell title="Centro de Distribuição" subtitle="Separação, expedição e reposição das filiais" primaryAction={null}>
      <div className="p-4 md:p-8 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <StockStat label="Aguardando separação" value={toPick.length} icon={Hourglass} tone="warning" />
          <StockStat label="Em separação" value={picking.length} icon={PackageOpen} tone="info" />
          <StockStat label="Em transporte" value={transit.length} icon={Truck} tone="info" />
          <StockStat label="Sugestões de reposição" value={suggestions.length} icon={RefreshCcw} />
        </div>
        <div className="grid lg:grid-cols-3 gap-4"><Queue title="Para separar" list={toPick} /><Queue title="Para expedir" list={picking} /><Queue title="Em transporte" list={transit} /></div>
        <Card className="p-5">
          <div className="font-semibold mb-1">Reposição automática</div><div className="text-sm text-muted-foreground mb-4">Filiais com itens abaixo do mínimo. Gera um pedido completando até o máximo.</div>
          <div className="space-y-2">{suggestions.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma filial abaixo do mínimo.</div>}
            {suggestions.map(s => <div key={s.b.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
              <div><div className="font-medium">{s.b.name}</div><div className="text-xs text-muted-foreground">{s.items.length} item(ns) abaixo do mínimo</div></div>
              <Button size="sm" variant="outline" onClick={() => { void saveDraft({ branchId: s.b.id, priority: "normal", desiredDate: "2026-11-18", notes: "Reposição automática", items: s.items }).then(async (r) => { if (!r.ok) return toast.error(r.error); const e = await actions.submit(r.order.id); e ? toast.error(e) : toast.success(`Pedido ${r.order.number} criado`); }); }}>Gerar pedido</Button>
            </div>)}</div>
        </Card>
      </div>
      <OrderSheet order={orders.find(o => o.id === openId) ?? null} onClose={() => setOpenId(null)} onEdit={() => setOpenId(null)} />
    </AppShell>
  );
}
