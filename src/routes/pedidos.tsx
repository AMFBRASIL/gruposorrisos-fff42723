import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StockStat } from "@/components/stock-ui";
import { NewOrderDialog, OrderSheet, priorityMeta } from "@/components/order-dialogs";
import { useSession, branchName, userName } from "@/lib/erp";
import { useOrders, statusLabels, kanbanColumns, isLate, type Order, type OrderStatus } from "@/lib/orders";
import { Plus, Search, ClipboardList, Hourglass, PackageOpen, Truck, CheckCircle2, AlertOctagon, List, Columns3, XCircle } from "lucide-react";

export const Route = createFileRoute("/pedidos")({
  head: () => ({ meta: [
    { title: "Pedidos de Materiais | Grupo Sorrisos" },
    { name: "description", content: "Solicitação, aprovação, separação, expedição e recebimento de materiais entre as filiais." },
    { property: "og:title", content: "Pedidos de Materiais | Grupo Sorrisos" },
    { property: "og:description", content: "Fluxo completo de pedidos de materiais." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: PedidosPage,
});

function PedidosPage() {
  const all = useOrders(); const ses = useSession();
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [q, setQ] = useState(""); const [status, setStatus] = useState<OrderStatus | "todos">("todos"); const [prio, setPrio] = useState("todas");
  const [newOpen, setNewOpen] = useState(false); const [editing, setEditing] = useState<Order | undefined>(); const [openId, setOpenId] = useState<string | null>(null);
  const scoped = all.filter(o => ses.scope.includes(o.branchId) || ses.scope.includes(o.sourceId));
  const rows = useMemo(() => scoped.filter(o => (status === "todos" || o.status === status) && (prio === "todas" || o.priority === prio) && `${o.number} ${branchName(o.branchId)} ${userName(o.requesterId)}`.toLowerCase().includes(q.toLowerCase())), [scoped, status, prio, q]);
  const n = (f: (o: Order) => boolean) => scoped.filter(f).length;
  const open = all.find(o => o.id === openId) ?? null;
  return (
    <AppShell title="Pedidos de Materiais" subtitle="Solicitação → Aprovação → Separação → Expedição → Recebimento" primaryAction={ses.can("pedidos.criar") ? <Button size="sm" onClick={() => { setEditing(undefined); setNewOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo Pedido</Button> : null}>
      <div className="p-4 md:p-8 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-8 gap-3">
          <StockStat label="Total" value={scoped.length} icon={ClipboardList} />
          <StockStat label="Aguardando aprovação" value={n(o => o.status === "enviado")} icon={Hourglass} tone="warning" />
          <StockStat label="Em separação" value={n(o => o.status === "aprovado" || o.status === "separacao")} icon={PackageOpen} tone="info" />
          <StockStat label="Em transporte" value={n(o => o.status === "transporte")} icon={Truck} tone="info" />
          <StockStat label="Parciais" value={n(o => o.status === "recebido_parcial")} icon={PackageOpen} tone="warning" />
          <StockStat label="Entregues" value={n(o => o.status === "concluido")} icon={CheckCircle2} tone="success" />
          <StockStat label="Cancelados" value={n(o => o.status === "cancelado" || o.status === "rejeitado")} icon={XCircle} tone="destructive" />
          <StockStat label="Atrasados" value={n(isLate)} icon={AlertOctagon} tone="destructive" />
        </div>
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Número, filial ou solicitante" value={q} onChange={e => setQ(e.target.value)} /></div>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={e => setStatus(e.target.value as OrderStatus | "todos")}><option value="todos">Todos os status</option>{(Object.keys(statusLabels) as OrderStatus[]).map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={prio} onChange={e => setPrio(e.target.value)}><option value="todas">Todas prioridades</option>{Object.keys(priorityMeta).map(p => <option key={p} value={p}>{p}</option>)}</select>
          <div className="flex gap-1 p-1 rounded-lg bg-muted">
            <button onClick={() => setView("lista")} className={`px-3 h-8 rounded-md text-xs flex items-center gap-1 ${view === "lista" ? "bg-card shadow-sm font-medium" : "text-muted-foreground"}`}><List className="h-3 w-3" />Lista</button>
            <button onClick={() => setView("kanban")} className={`px-3 h-8 rounded-md text-xs flex items-center gap-1 ${view === "kanban" ? "bg-card shadow-sm font-medium" : "text-muted-foreground"}`}><Columns3 className="h-3 w-3" />Kanban</button>
          </div>
        </div>
        {view === "lista" ? (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide"><tr>{["Número", "Filial", "Solicitante", "Itens", "Prioridade", "Data desejada", "Status"].map(h => <th key={h} className="text-left font-medium px-4 py-3">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum pedido.</td></tr>}
                {rows.map(o => <tr key={o.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setOpenId(o.id)}>
                  <td className="px-4 py-3 font-mono text-xs">{o.number}</td><td className="px-4 py-3">{branchName(o.branchId)}</td><td className="px-4 py-3">{userName(o.requesterId)}</td><td className="px-4 py-3">{o.items.length}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className={`capitalize ${priorityMeta[o.priority]}`}>{o.priority}</Badge></td>
                  <td className={`px-4 py-3 ${isLate(o) ? "text-destructive font-medium" : ""}`}>{o.desiredDate.split("-").reverse().join("/")}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{statusLabels[o.status]}</Badge></td>
                </tr>)}
              </tbody>
            </table>
          </Card>
        ) : (
          <div className="overflow-x-auto"><div className="flex gap-4 min-w-max">
            {kanbanColumns.map(col => { const items = rows.filter(o => o.status === col); return (
              <div key={col} className="w-72 shrink-0 rounded-lg bg-muted/40 p-3">
                <div className="flex justify-between mb-3 px-1 text-sm font-semibold">{statusLabels[col]}<span className="text-xs text-muted-foreground font-normal">{items.length}</span></div>
                <div className="space-y-2">{items.map(o => <Card key={o.id} className="p-3 cursor-pointer hover:shadow-md" onClick={() => setOpenId(o.id)}>
                  <div className="flex justify-between"><span className="font-mono text-xs">{o.number}</span><Badge variant="outline" className={`capitalize text-[10px] ${priorityMeta[o.priority]}`}>{o.priority}</Badge></div>
                  <div className="text-sm font-medium mt-1">{branchName(o.branchId)}</div><div className="text-xs text-muted-foreground">{o.items.length} itens · {userName(o.requesterId)}</div>
                </Card>)}</div>
              </div>
            ); })}
          </div></div>
        )}
      </div>
      {newOpen && <NewOrderDialog open onClose={() => setNewOpen(false)} initial={editing} />}
      <OrderSheet order={open} onClose={() => setOpenId(null)} onEdit={o => { setOpenId(null); setEditing(o); setNewOpen(true); }} />
    </AppShell>
  );
}
