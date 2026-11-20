import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StockStat } from "@/components/stock-ui";
import { NewOrderDialog, OrderSheet, priorityMeta } from "@/components/order-dialogs";
import { SupplierOrderDetail } from "@/components/supplier-order-detail";
import {
  useProcurementSession as useSession,
  branchName,
  userName,
  useOrders,
  statusLabels,
  isLate,
  useSupplierRequests,
  supplierStatus,
  usePurchasing,
} from "@/lib/procurement-live";
import type { Order, OrderStatus } from "@/lib/orders";
import type { SupplierRequest } from "@/lib/supplier-orders";
import { getMaterial, brl, useStock } from "@/lib/stock-live";
import { stageCursor } from "@/lib/order-workflow";
import {
  Plus, Search, ClipboardList, Hourglass, PackageOpen, Truck, CheckCircle2,
  AlertOctagon, Gauge, Wallet, Siren, ArrowRight, Building2, Warehouse,
} from "lucide-react";

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

const orderValue = (o: Order) => o.items.reduce((a, i) => a + i.requested * getMaterial(i.materialId).cost, 0);
const requestValue = (r: SupplierRequest) => (r.versions.at(-1)?.items ?? r.items).reduce((a, i) => a + i.requested * (i.unitPrice ?? getMaterial(i.materialId).cost), 0);
const fmt = (d: string) => d.slice(0, 10).split("-").reverse().join("/");

const statusTone: Partial<Record<OrderStatus, string>> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  enviado: "bg-warning/10 text-warning border-warning/30",
  correcao: "bg-warning/10 text-warning border-warning/30",
  rejeitado: "bg-destructive/10 text-destructive border-destructive/30",
  aprovado: "bg-info/10 text-info border-info/30",
  separacao: "bg-info/10 text-info border-info/30",
  transporte: "bg-primary/10 text-primary border-primary/30",
  recebido_parcial: "bg-warning/10 text-warning border-warning/30",
  concluido: "bg-success/10 text-success border-success/30",
  cancelado: "bg-destructive/10 text-destructive border-destructive/30",
};

const supplierTone: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  aguardando: "bg-warning/10 text-warning border-warning/30",
  resposta: "bg-info/10 text-info border-info/30",
  aprovado: "bg-success/10 text-success border-success/30",
  correcao: "bg-warning/10 text-warning border-warning/30",
};

const STATUS_FILTERS: Array<{ id: string; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "enviado", label: "Aguardando" },
  { id: "aprovado", label: "Aprovado" },
  { id: "separacao", label: "Separação" },
  { id: "transporte", label: "Transporte" },
  { id: "concluido", label: "Concluído" },
  { id: "cancelado", label: "Cancelado" },
  { id: "rejeitado", label: "Rejeitado" },
  { id: "aguardando", label: "Aguardando preços" },
];

type ListRow =
  | { kind: "cd"; id: string; at: string; order: Order }
  | { kind: "supplier"; id: string; at: string; request: SupplierRequest };

function situationOf(order: Order) {
  const stage = stageCursor(order.workflow);
  return {
    label: statusLabels[order.status],
    tone: statusTone[order.status] ?? "",
    stage: stage && !stage.finished ? stage.current?.name : stage?.finished ? "Concluído" : undefined,
  };
}

function PedidosPage() {
  useStock();
  const all = useOrders();
  const ses = useSession();
  const supplierRequests = useSupplierRequests();
  const { sup } = usePurchasing();
  const [channel, setChannel] = useState<"all" | "cd" | "supplier">("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("todos");
  const [prio, setPrio] = useState("todas");
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<Order | undefined>();
  const [openId, setOpenId] = useState<string | null>(null);
  const [supplierOpen, setSupplierOpen] = useState<string | null>(null);

  const scopedOrders = all.filter((o) => ses.scope.includes(o.branchId) || ses.scope.includes(o.sourceId));
  const scopedRequests = supplierRequests.filter((r) => ses.scope.includes(r.branchId));
  const n = (f: (o: Order) => boolean) => scopedOrders.filter(f).length;
  const open = all.find((o) => o.id === openId) ?? null;

  const late = scopedOrders.filter(isLate);
  const urgent = scopedOrders.filter((o) => o.priority === "urgente" && !["concluido", "cancelado", "rejeitado"].includes(o.status));
  const approved = scopedOrders.reduce((a, o) => a + o.items.reduce((b, i) => b + i.approved, 0), 0);
  const shipped = scopedOrders.reduce((a, o) => a + o.items.reduce((b, i) => b + i.shipped, 0), 0);
  const fillRate = approved ? Math.round((shipped / approved) * 100) : 0;
  const totalValue = scopedOrders.reduce((a, o) => a + orderValue(o), 0)
    + scopedRequests.reduce((a, r) => a + requestValue(r), 0);

  const rows = useMemo(() => {
    const list: ListRow[] = [];
    if (channel !== "supplier") {
      for (const order of scopedOrders) {
        list.push({ kind: "cd", id: order.id, at: order.createdAt, order });
      }
    }
    if (channel !== "cd") {
      for (const request of scopedRequests) {
        if (supplierFilter !== "all" && request.supplierId !== supplierFilter) continue;
        list.push({ kind: "supplier", id: request.id, at: request.createdAt, request });
      }
    }

    const needle = q.trim().toLowerCase();
    return list
      .filter((row) => {
        if (row.kind === "cd") {
          const o = row.order;
          if (prio !== "todas" && o.priority !== prio) return false;
          if (status === "todos") { /* ok */ }
          else if (status === "aguardando") return false;
          else if (status === "enviado") {
            if (!["enviado", "correcao"].includes(o.status)) return false;
          } else if (o.status !== status) return false;
          if (!needle) return true;
          return `${o.number} ${branchName(o.branchId)} ${userName(o.requesterId)}`.toLowerCase().includes(needle);
        }
        const r = row.request;
        if (prio !== "todas" && r.priority !== prio) return false;
        if (status === "todos") { /* ok */ }
        else if (status === "aguardando") {
          if (r.status !== "aguardando") return false;
        } else if (status === "enviado") {
          if (!["aguardando", "resposta", "correcao"].includes(r.status)) return false;
        } else if (status === "aprovado") {
          if (r.status !== "aprovado") return false;
        } else if (status === "cancelado" || status === "rejeitado" || status === "separacao" || status === "transporte" || status === "concluido") {
          return false;
        } else if (r.status !== status) return false;
        if (!needle) return true;
        const supplier = sup.find((s) => s.id === r.supplierId)?.name ?? "";
        return `${r.number} ${branchName(r.branchId)} ${supplier}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [channel, scopedOrders, scopedRequests, supplierFilter, status, prio, q, sup]);

  return (
    <AppShell
      title="Pedidos de Materiais"
      subtitle="Solicitação → Aprovação → Separação → Expedição → Recebimento"
      primaryAction={ses.can("pedidos.criar") ? (
        <Button size="sm" onClick={() => { setEditing(undefined); setNewOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />Novo Pedido
        </Button>
      ) : null}
    >
      <div className="p-4 md:p-8 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StockStat label="Pedidos" value={scopedOrders.length + scopedRequests.length} icon={ClipboardList} hint={`${scopedOrders.length} CD · ${scopedRequests.length} fornecedor`} />
          <StockStat label="Aguardando aprovação" value={n((o) => o.status === "enviado")} icon={Hourglass} tone="warning" />
          <StockStat label="Em separação" value={n((o) => o.status === "aprovado" || o.status === "separacao")} icon={PackageOpen} tone="info" />
          <StockStat label="Em transporte" value={n((o) => o.status === "transporte")} icon={Truck} tone="info" />
          <StockStat label="Entregues" value={n((o) => o.status === "concluido")} icon={CheckCircle2} tone="success" />
          <StockStat label="Atrasados" value={late.length} icon={AlertOctagon} tone="destructive" />
          <StockStat label="Taxa de atendimento" value={`${fillRate}%`} icon={Gauge} tone="success" hint="expedido / aprovado" />
          <StockStat label="Valor solicitado" value={brl(totalValue)} icon={Wallet} hint="CD + fornecedor" />
        </div>

        {(late.length > 0 || urgent.length > 0) && (
          <Card className="p-4 border-destructive/30 bg-destructive/5 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 font-semibold text-sm text-destructive"><Siren className="h-4 w-4" />Atenção</div>
            <div className="flex flex-wrap gap-2 flex-1">
              {[...urgent, ...late.filter((o) => !urgent.includes(o))].slice(0, 6).map((o) => (
                <button key={o.id} onClick={() => setOpenId(o.id)} className="rounded-full border border-border bg-card px-3 py-1 text-xs hover:border-primary/40">
                  <span className="font-mono">{o.number}</span> · {branchName(o.branchId)} · {isLate(o) ? "atrasado" : "urgente"}
                </button>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {([
              ["all", "Todos"],
              ["cd", "Centro de Distribuição"],
              ["supplier", "Fornecedores"],
            ] as const).map(([value, label]) => (
              <Button key={value} variant={channel === value ? "default" : "outline"} size="sm" onClick={() => setChannel(value)}>
                {label}
              </Button>
            ))}
            {channel !== "cd" && (
              <select
                aria-label="Filtrar fornecedor"
                className="h-9 border border-input rounded-md bg-background text-sm px-3"
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
              >
                <option value="all">Todos fornecedores</option>
                {sup.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <Button className="ml-auto" variant="outline" size="sm" asChild>
              <Link to="/fornecedores">Pedidos por fornecedor <ArrowRight className="h-4 w-4 ml-2" /></Link>
            </Button>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Número, filial, solicitante ou fornecedor" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={prio} onChange={(e) => setPrio(e.target.value)}>
              <option value="todas">Todas prioridades</option>
              {Object.keys(priorityMeta).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.id}
                onClick={() => setStatus(item.id)}
                className={`h-8 px-3 rounded-full text-xs border transition-colors ${
                  status === item.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-sm">Listagem de pedidos</h2>
            <span className="text-xs text-muted-foreground">{rows.length} registro{rows.length === 1 ? "" : "s"}</span>
          </div>

          {rows.length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground">Nenhum pedido encontrado com os filtros atuais.</Card>
          )}

          <div className="space-y-3">
            {rows.map((row) => {
              if (row.kind === "cd") {
                const o = row.order;
                const sit = situationOf(o);
                return (
                  <Card
                    key={`cd-${o.id}`}
                    className="p-4 border-border/70 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => setOpenId(o.id)}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            <Warehouse className="h-3 w-3" /> CD
                          </span>
                          <span className="font-mono text-sm font-semibold">{o.number}</span>
                          <Badge variant="outline" className={`capitalize ${priorityMeta[o.priority]}`}>{o.priority}</Badge>
                          {isLate(o) && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Atrasado</Badge>}
                        </div>
                        <div className="text-sm font-medium">{branchName(o.branchId)}</div>
                        <div className="text-xs text-muted-foreground">
                          {userName(o.requesterId)} · {o.items.length} ite{o.items.length === 1 ? "m" : "ns"} · {brl(orderValue(o))} · criado {fmt(o.createdAt)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <div className="text-right mr-2">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Prazo</div>
                          <div className={`text-sm font-medium ${isLate(o) ? "text-destructive" : ""}`}>{fmt(o.desiredDate)}</div>
                        </div>
                        <div className="min-w-[10rem]">
                          <Badge variant="outline" className={`w-full justify-center py-1.5 ${sit.tone}`}>{sit.label}</Badge>
                          {sit.stage && <div className="mt-1 text-[11px] text-center text-muted-foreground">Etapa: {sit.stage}</div>}
                        </div>
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setOpenId(o.id); }}>Abrir</Button>
                      </div>
                    </div>
                  </Card>
                );
              }

              const r = row.request;
              const supplier = sup.find((s) => s.id === r.supplierId)?.name ?? "Fornecedor";
              return (
                <Card
                  key={`sup-${r.id}`}
                  className="p-4 border-border/70 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => setSupplierOpen(r.id)}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <Building2 className="h-3 w-3" /> Fornecedor
                        </span>
                        <span className="font-mono text-sm font-semibold">{r.number}</span>
                        <Badge variant="outline" className={`capitalize ${priorityMeta[r.priority as keyof typeof priorityMeta] ?? ""}`}>{r.priority}</Badge>
                      </div>
                      <div className="text-sm font-medium">{supplier}</div>
                      <div className="text-xs text-muted-foreground">
                        {branchName(r.branchId)} · {r.items.length} ite{r.items.length === 1 ? "m" : "ns"} · {brl(requestValue(r))} · criado {fmt(r.createdAt)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <div className="text-right mr-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Prazo</div>
                        <div className="text-sm font-medium">{fmt(r.desiredDate)}</div>
                      </div>
                      <div className="min-w-[10rem]">
                        <Badge variant="outline" className={`w-full justify-center py-1.5 ${supplierTone[r.status] ?? ""}`}>
                          {supplierStatus[r.status as keyof typeof supplierStatus] ?? r.status}
                        </Badge>
                      </div>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSupplierOpen(r.id); }}>Abrir</Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {newOpen && <NewOrderDialog open onClose={() => setNewOpen(false)} initial={editing} />}
      {supplierOpen && <SupplierOrderDetail id={supplierOpen} onClose={() => setSupplierOpen(null)} />}
      <OrderSheet key={open?.id ?? "closed"} order={open} onClose={() => setOpenId(null)} onEdit={(o) => { setOpenId(null); setEditing(o); setNewOpen(true); }} />
    </AppShell>
  );
}
