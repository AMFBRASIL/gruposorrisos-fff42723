import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClients, useDeals, useInvoices } from "@/lib/store";
import { getUser, formatBRL } from "@/lib/mock-data";
import { Search, Phone, Mail, MapPin, TrendingUp, FileText, Briefcase, Plus } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/clientes")({ component: ClientesPage });

const statusMeta: Record<string, { label: string; cls: string }> = {
  ativo:    { label: "Ativo",    cls: "bg-success/15 text-success border-success/30" },
  prospect: { label: "Prospect", cls: "bg-info/15 text-info border-info/30" },
  inativo:  { label: "Inativo",  cls: "bg-muted text-muted-foreground border-border" },
};

function ClientesPage() {
  const clients = useClients();
  const deals = useDeals();
  const invoices = useInvoices();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"todos" | "ativo" | "prospect" | "inativo">("todos");

  const enriched = useMemo(() => clients.map(c => {
    const cDeals = deals.filter(d => d.clientId === c.id);
    const openDeals = cDeals.filter(d => d.stage !== "ganho" && d.stage !== "perdido");
    const wonValue = cDeals.filter(d => d.stage === "ganho").reduce((s,d) => s + d.value, 0);
    const pipeline = openDeals.reduce((s,d) => s + d.value * (d.probability / 100), 0);
    const cInv = invoices.filter(i => i.clientId === c.id);
    const overdue = cInv.filter(i => i.status === "vencida").length;
    return { ...c, openDeals: openDeals.length, wonValue, pipeline, invoiceCount: cInv.length, overdue };
  }), [clients, deals, invoices]);

  const list = enriched
    .filter(c => filter === "todos" || c.status === filter)
    .filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.contactName.toLowerCase().includes(q.toLowerCase()));

  const totals = useMemo(() => ({
    ativos: clients.filter(c => c.status === "ativo").length,
    prospects: clients.filter(c => c.status === "prospect").length,
    ltv: clients.reduce((s, c) => s + c.ltv, 0),
    pipeline: enriched.reduce((s, c) => s + c.pipeline, 0),
  }), [clients, enriched]);

  return (
    <AppShell title="Clientes" subtitle="Base de relacionamento comercial" primaryAction={<Button size="sm" onClick={() => setWizard(true)}><Plus className="h-4 w-4 mr-1" /> Novo Cliente</Button>}>
      <CreateClientWizard open={wizard} onClose={() => setWizard(false)} />
      <div className="p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Clientes ativos" value={totals.ativos} icon={Briefcase} tone="success" />
          <StatCard label="Prospects" value={totals.prospects} icon={TrendingUp} tone="info" />
          <StatCard label="LTV acumulado" value={formatBRL(totals.ltv)} icon={FileText} tone="primary" />
          <StatCard label="Pipeline ponderado" value={formatBRL(totals.pipeline)} icon={TrendingUp} tone="warning" />
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cliente ou contato..." className="pl-9" />
          </div>
          <div className="flex gap-1 p-1 rounded-lg bg-muted">
            {(["todos","ativo","prospect","inativo"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 h-8 rounded-md text-xs capitalize transition-colors ${filter === f ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}>{f}</button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map(c => {
            const owner = getUser(c.ownerId);
            const m = statusMeta[c.status];
            return (
              <Card key={c.id} className="p-5 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-start gap-3 mb-4">
                  <Avatar className="h-12 w-12"><AvatarFallback style={{ backgroundColor: c.color, color: "white" }}>{c.logo}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {c.city} · {c.segment}</div>
                  </div>
                  <Badge variant="outline" className={m.cls}>{m.label}</Badge>
                </div>

                <div className="space-y-1.5 text-xs mb-4 pb-4 border-b border-border">
                  <div className="font-medium text-sm">{c.contactName}</div>
                  <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3 w-3" /> {c.contactEmail}</div>
                  <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3 w-3" /> {c.contactPhone}</div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-4">
                  <Mini label="Oport." value={c.openDeals} />
                  <Mini label="LTV" value={formatBRL(c.ltv)} small />
                  <Mini label="Pipeline" value={formatBRL(c.pipeline)} small />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {owner && <Avatar className="h-5 w-5"><AvatarFallback style={{ backgroundColor: owner.color, color: "white", fontSize: 9 }}>{owner.initials}</AvatarFallback></Avatar>}
                    <span>Resp. {owner?.name.split(" ")[0]}</span>
                  </div>
                  {c.overdue > 0 && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">{c.overdue} fatura(s) vencida(s)</Badge>}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: any; tone: "success" | "info" | "primary" | "warning" }) {
  const bg = { success: "bg-success/10 text-success", info: "bg-info/10 text-info", primary: "bg-primary/10 text-primary", warning: "bg-warning/10 text-warning" }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${bg}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold truncate">{value}</div>
        </div>
      </div>
    </Card>
  );
}

function Mini({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-md bg-muted/50 py-2 px-1">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`font-semibold ${small ? "text-xs" : "text-sm"}`}>{value}</div>
    </div>
  );
}
