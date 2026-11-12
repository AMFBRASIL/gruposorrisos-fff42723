import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StockStat, ChartCard, chartColors, tooltipStyle, axisProps } from "@/components/stock-ui";
import { NewOrderDialog, OrderSheet, priorityMeta } from "@/components/order-dialogs";
import { useSession, branchName, userName } from "@/lib/erp";
import { useOrders, statusLabels, kanbanColumns, isLate, type Order, type OrderStatus } from "@/lib/orders";
import { getMaterial, brl } from "@/lib/stock";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from "recharts";
import { Plus, Search, ClipboardList, Hourglass, PackageOpen, Truck, CheckCircle2, AlertOctagon, List, Columns3, Gauge, Wallet, Siren, ArrowRight } from "lucide-react";

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

const flowSteps: OrderStatus[] = ["enviado", "aprovado", "separacao", "transporte", "concluido"];
const progress = (s: OrderStatus) => s === "rascunho" ? 5 : s === "recebido_parcial" ? 90 : s === "concluido" ? 100 : ["cancelado", "rejeitado"].includes(s) ? 0 : ((flowSteps.indexOf(s) + 1) / flowSteps.length) * 100;
const orderValue = (o: Order) => o.items.reduce((a, i) => a + i.requested * getMaterial(i.materialId).cost, 0);
const statusTone: Partial<Record<OrderStatus, string>> = { enviado: "bg-warning/10 text-warning border-warning/30", aprovado: "bg-info/10 text-info border-info/30", separacao: "bg-info/10 text-info border-info/30", transporte: "bg-primary/10 text-primary border-primary/30", recebido_parcial: "bg-warning/10 text-warning border-warning/30", concluido: "bg-success/10 text-success border-success/30", cancelado: "bg-destructive/10 text-destructive border-destructive/30", rejeitado: "bg-destructive/10 text-destructive border-destructive/30" };
const fmt = (d: string) => d.slice(0, 10).split("-").reverse().join("/");

function PedidosPage() {
  const all = useOrders(); const ses = useSession();
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [q, setQ] = useState(""); const [status, setStatus] = useState<OrderStatus | "todos">("todos"); const [prio, setPrio] = useState("todas");
  const [newOpen, setNewOpen] = useState(false); const [editing, setEditing] = useState<Order | undefined>(); const [openId, setOpenId] = useState<string | null>(null);
  const scoped = all.filter(o => ses.scope.includes(o.branchId) || ses.scope.includes(o.sourceId));
  const rows = useMemo(() => scoped.filter(o => (status === "todos" || o.status === status) && (prio === "todas" || o.priority === prio) && `${o.number} ${branchName(o.branchId)} ${userName(o.requesterId)}`.toLowerCase().includes(q.toLowerCase())), [scoped, status, prio, q]);
  const n = (f: (o: Order) => boolean) => scoped.filter(f).length;
  const open = all.find(o => o.id === openId) ?? null;

  const approved = scoped.reduce((a, o) => a + o.items.reduce((b, i) => b + i.approved, 0), 0);
  const shipped = scoped.reduce((a, o) => a + o.items.reduce((b, i) => b + i.shipped, 0), 0);
  const fillRate = approved ? Math.round((shipped / approved) * 100) : 0;
  const totalValue = scoped.reduce((a, o) => a + orderValue(o), 0);
  const late = scoped.filter(isLate);
  const urgent = scoped.filter(o => o.priority === "urgente" && !["concluido", "cancelado", "rejeitado"].includes(o.status));

  const byStatus = (Object.keys(statusLabels) as OrderStatus[]).map(s => ({ name: statusLabels[s], value: n(o => o.status === s) })).filter(x => x.value > 0);
  const byBranch = Object.entries(scoped.reduce<Record<string, number>>((a, o) => { const k = branchName(o.branchId); a[k] = (a[k] ?? 0) + 1; return a; }, {})).map(([name, total]) => ({ name: name.replace(/^Clínica |^Unidade /, ""), total })).sort((a, b) => b.total - a.total).slice(0, 6);
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(Date.UTC(2026, 10, 11 - 13 + i)).toISOString().slice(0, 10); return { name: fmt(d).slice(0, 5), pedidos: scoped.filter(o => o.createdAt.slice(0, 10) === d).length }; });

  return (
    <AppShell title="Pedidos de Materiais" subtitle="Solicitação → Aprovação → Separação → Expedição → Recebimento" primaryAction={ses.can("pedidos.criar") ? <Button size="sm" onClick={() => { setEditing(undefined); setNewOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo Pedido</Button> : null}>
      <div className="p-4 md:p-8 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StockStat label="Pedidos" value={scoped.length} icon={ClipboardList} hint={`${n(o => o.status === "rascunho")} rascunhos`} />
          <StockStat label="Aguardando aprovação" value={n(o => o.status === "enviado")} icon={Hourglass} tone="warning" />
          <StockStat label="Em separação" value={n(o => o.status === "aprovado" || o.status === "separacao")} icon={PackageOpen} tone="info" />
          <StockStat label="Em transporte" value={n(o => o.status === "transporte")} icon={Truck} tone="info" />
          <StockStat label="Entregues" value={n(o => o.status === "concluido")} icon={CheckCircle2} tone="success" />
          <StockStat label="Atrasados" value={late.length} icon={AlertOctagon} tone="destructive" />
          <StockStat label="Taxa de atendimento" value={`${fillRate}%`} icon={Gauge} tone="success" hint="expedido / aprovado" />
          <StockStat label="Valor solicitado" value={brl(totalValue)} icon={Wallet} hint="custo médio" />
        </div>

        {(late.length > 0 || urgent.length > 0) && (
          <Card className="p-4 border-destructive/30 bg-destructive/5 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 font-semibold text-sm text-destructive"><Siren className="h-4 w-4" />Atenção</div>
            <div className="flex flex-wrap gap-2 flex-1">
              {[...urgent, ...late.filter(o => !urgent.includes(o))].slice(0, 6).map(o => <button key={o.id} onClick={() => setOpenId(o.id)} className="rounded-full border border-border bg-card px-3 py-1 text-xs hover:border-primary/40"><span className="font-mono">{o.number}</span> · {branchName(o.branchId)} · {isLate(o) ? "atrasado" : "urgente"}</button>)}
            </div>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-4">
          <ChartCard title="Pedidos por status" desc="Distribuição atual do fluxo">
            <ResponsiveContainer><PieChart><Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>{byStatus.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Volume por filial" desc="Filiais que mais solicitam">
            <ResponsiveContainer><BarChart data={byBranch} layout="vertical" margin={{ left: 10 }}><CartesianGrid horizontal={false} stroke="var(--border)" /><XAxis type="number" {...axisProps} allowDecimals={false} /><YAxis type="category" dataKey="name" width={90} {...axisProps} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} /><Bar dataKey="total" fill="var(--chart-1)" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Novos pedidos" desc="Últimos 14 dias">
            <ResponsiveContainer><AreaChart data={days}><defs><linearGradient id="gp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" {...axisProps} /><YAxis {...axisProps} allowDecimals={false} width={24} /><Tooltip contentStyle={tooltipStyle} /><Area dataKey="pedidos" stroke="var(--chart-1)" fill="url(#gp)" strokeWidth={2} /></AreaChart></ResponsiveContainer>
          </ChartCard>
        </div>

        <Card className="p-3 flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Número, filial ou solicitante" value={q} onChange={e => setQ(e.target.value)} /></div>
          <div className="flex gap-1 flex-wrap">
            {(["todos", "enviado", "separacao", "transporte", "concluido"] as const).map(s => <button key={s} onClick={() => setStatus(s)} className={`h-8 px-3 rounded-full text-xs border transition-colors ${status === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>{s === "todos" ? "Todos" : statusLabels[s]}</button>)}
          </div>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={prio} onChange={e => setPrio(e.target.value)}><option value="todas">Todas prioridades</option>{Object.keys(priorityMeta).map(p => <option key={p} value={p}>{p}</option>)}</select>
          <div className="flex gap-1 p-1 rounded-lg bg-muted">
            <button onClick={() => setView("lista")} className={`px-3 h-8 rounded-md text-xs flex items-center gap-1 ${view === "lista" ? "bg-card shadow-sm font-medium" : "text-muted-foreground"}`}><List className="h-3 w-3" />Lista</button>
            <button onClick={() => setView("kanban")} className={`px-3 h-8 rounded-md text-xs flex items-center gap-1 ${view === "kanban" ? "bg-card shadow-sm font-medium" : "text-muted-foreground"}`}><Columns3 className="h-3 w-3" />Kanban</button>
          </div>
        </Card>

        {view === "lista" ? (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide"><tr>{["Pedido", "Filial / Solicitante", "Itens", "Valor", "Prioridade", "Prazo", "Progresso", "Status", ""].map(h => <th key={h} className="text-left font-medium px-4 py-3">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">Nenhum pedido encontrado.</td></tr>}
                {rows.map(o => <tr key={o.id} className="hover:bg-muted/30 cursor-pointer group" onClick={() => setOpenId(o.id)}>
                  <td className="px-4 py-3"><div className="font-mono text-xs font-semibold">{o.number}</div><div className="text-[11px] text-muted-foreground">{fmt(o.createdAt)}</div></td>
                  <td className="px-4 py-3"><div className="font-medium">{branchName(o.branchId)}</div><div className="text-xs text-muted-foreground">{userName(o.requesterId)}</div></td>
                  <td className="px-4 py-3">{o.items.length}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{brl(orderValue(o))}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className={`capitalize ${priorityMeta[o.priority]}`}>{o.priority}</Badge></td>
                  <td className={`px-4 py-3 whitespace-nowrap ${isLate(o) ? "text-destructive font-medium" : ""}`}>{fmt(o.desiredDate)}</td>
                  <td className="px-4 py-3 w-36"><div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${progress(o.status)}%` }} /></div></td>
                  <td className="px-4 py-3"><Badge variant="outline" className={statusTone[o.status]}>{statusLabels[o.status]}</Badge></td>
                  <td className="px-4 py-3"><ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" /></td>
                </tr>)}
              </tbody>
            </table>
          </Card>
        ) : (
          <div className="overflow-x-auto pb-2"><div className="flex gap-4 min-w-max">
            {kanbanColumns.map(col => { const items = rows.filter(o => o.status === col); return (
              <div key={col} className="w-80 shrink-0 rounded-xl bg-muted/40 p-3 border border-border">
                <div className="flex justify-between items-center mb-3 px-1"><span className="text-sm font-semibold">{statusLabels[col]}</span><span className="text-xs rounded-full bg-card border border-border px-2">{items.length}</span></div>
                <div className="space-y-2">{items.map(o => <Card key={o.id} className="p-4 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all" onClick={() => setOpenId(o.id)}>
                  <div className="flex justify-between"><span className="font-mono text-xs font-semibold">{o.number}</span><Badge variant="outline" className={`capitalize text-[10px] ${priorityMeta[o.priority]}`}>{o.priority}</Badge></div>
                  <div className="text-sm font-medium mt-2">{branchName(o.branchId)}</div>
                  <div className="text-xs text-muted-foreground">{o.items.length} itens · {brl(orderValue(o))}</div>
                  <div className="mt-3 flex justify-between text-[11px] text-muted-foreground"><span>{userName(o.requesterId)}</span><span className={isLate(o) ? "text-destructive font-medium" : ""}>{fmt(o.desiredDate)}</span></div>
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
