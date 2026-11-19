import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useInvoices, useClients, useProjects, invoicesStore } from "@/lib/store";
import { invoiceTotal, formatBRL, invoiceStatusMeta } from "@/lib/mock-data";
import { CreateInvoiceWizard } from "@/components/create-invoice-wizard";
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, FileText, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/financeiro")({ head: () => ({ meta: [{ title: 'Financeiro | Grupo Sorrisos' }, { name: 'description', content: 'Faturas, custos e orçamentos do Grupo Sorrisos.' }, { property: 'og:title', content: 'Financeiro | Grupo Sorrisos' }, { property: 'og:description', content: 'Acompanhamento financeiro e orçamentário.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }), component: FinanceiroPage });

function FinanceiroPage() {
  const invoices = useInvoices();
  const clients = useClients();
  const projects = useProjects();
  const costEntries: { category: string; amount: number; projectId: string }[] = [];
  const projectBudgets: { projectId: string; budget: number }[] = [];
  const today = useMemo(() => { const date = new Date(); date.setHours(0, 0, 0, 0); return date; }, []);
  const [wizard, setWizard] = useState(false);

  const totals = useMemo(() => {
    const paid = invoices.filter(i => i.status === "paga");
    const open = invoices.filter(i => i.status === "enviada" || i.status === "vencida");
    const overdue = invoices.filter(i => i.status === "vencida");
    const revenue = paid.reduce((s, i) => s + invoiceTotal(i), 0);
    const receivable = open.reduce((s, i) => s + invoiceTotal(i), 0);
    const overdueValue = overdue.reduce((s, i) => s + invoiceTotal(i), 0);
    const totalCosts = costEntries.reduce((s, c) => s + c.amount, 0);
    const margin = revenue - totalCosts;
    const marginPct = revenue > 0 ? Math.round((margin / revenue) * 100) : 0;
    return { revenue, receivable, overdueValue, totalCosts, margin, marginPct, paidCount: paid.length, overdueCount: overdue.length };
  }, [invoices]);

  const projectMargins = useMemo(() => projects.map(p => {
    const budget = projectBudgets.find(b => b.projectId === p.id)?.budget || 0;
    const cost = costEntries.filter(c => c.projectId === p.id).reduce((s, c) => s + c.amount, 0);
    const billed = invoices.filter(i => i.projectId === p.id).reduce((s, i) => s + invoiceTotal(i), 0);
    const usage = budget > 0 ? Math.round((cost / budget) * 100) : 0;
    return { project: p, budget, cost, billed, usage, margin: billed - cost };
  }), [projects, invoices]);

  const costsByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    costEntries.forEach(c => { m[c.category] = (m[c.category] || 0) + c.amount; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, []);

  const recentInvoices = [...invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate)).slice(0, 8);

  return (
    <AppShell title="Financeiro" subtitle="Receita, custos e faturamento" primaryAction={<Button size="sm" onClick={() => setWizard(true)}><FileText className="h-4 w-4 mr-1" /> Nova Fatura</Button>}>
      <CreateInvoiceWizard open={wizard} onClose={() => setWizard(false)} />
      <div className="p-4 md:p-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="Receita realizada" value={formatBRL(totals.revenue)} trend="+12%" icon={DollarSign} tone="success" />
          <KPI label="A receber" value={formatBRL(totals.receivable)} sub={`${totals.paidCount} pagas`} icon={Wallet} tone="info" />
          <KPI label="Vencidas" value={formatBRL(totals.overdueValue)} sub={`${totals.overdueCount} faturas`} icon={AlertCircle} tone="destructive" />
          <KPI label="Margem operacional" value={`${totals.marginPct}%`} sub={formatBRL(totals.margin)} icon={totals.margin >= 0 ? TrendingUp : TrendingDown} tone={totals.margin >= 0 ? "success" : "destructive"} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Custos por categoria */}
          <Card className="p-5 lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold">Custos por categoria</div>
                <div className="text-xs text-muted-foreground">Total: {formatBRL(totals.totalCosts)}</div>
              </div>
              <div className="h-8 w-8 rounded-md bg-warning/10 text-warning flex items-center justify-center"><TrendingDown className="h-4 w-4" /></div>
            </div>
            <div className="space-y-3">
              {costsByCategory.map(([cat, val]) => {
                const pct = Math.round((val / totals.totalCosts) * 100);
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{cat}</span>
                      <span className="text-muted-foreground tabular-nums">{formatBRL(val)} · {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-chart-5" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Margem por projeto */}
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold">Margem por projeto</div>
                <div className="text-xs text-muted-foreground">Orçado · Custo · Faturado · Margem</div>
              </div>
              <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center"><DollarSign className="h-4 w-4" /></div>
            </div>
            <div className="space-y-3">
              {projectMargins.map(({ project, budget, cost, billed, usage, margin }) => {
                const over = usage > 100;
                return (
                  <div key={project.id} className="p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
                        <span className="font-medium text-sm truncate">{project.name}</span>
                      </div>
                      <Badge variant="outline" className={margin >= 0 ? "bg-success/10 text-success border-success/30" : "bg-destructive/10 text-destructive border-destructive/30"}>
                        {margin >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                        {formatBRL(margin)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
                      <Tile label="Orçado" value={formatBRL(budget)} />
                      <Tile label="Custo" value={formatBRL(cost)} tone={over ? "destructive" : undefined} />
                      <Tile label="Faturado" value={formatBRL(billed)} tone="success" />
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full transition-all ${over ? "bg-destructive" : usage > 80 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(usage, 100)}%` }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">{usage}% do orçamento consumido</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Faturas recentes */}
        <Card className="overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <div className="font-semibold">Faturas recentes</div>
              <div className="text-xs text-muted-foreground">{invoices.length} no total</div>
            </div>
            <Button variant="outline" size="sm">Ver todas</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Número</th>
                  <th className="text-left font-medium px-4 py-2">Cliente</th>
                  <th className="text-left font-medium px-4 py-2">Emissão</th>
                  <th className="text-left font-medium px-4 py-2">Vencimento</th>
                  <th className="text-right font-medium px-4 py-2">Valor</th>
                  <th className="text-left font-medium px-4 py-2">Status</th>
                  <th className="text-right font-medium px-4 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map(inv => {
                  const client = clients.find(c => c.id === inv.clientId);
                  const m = invoiceStatusMeta[inv.status];
                  const due = new Date(inv.dueDate);
                  const daysLeft = Math.round((due.getTime() - today.getTime()) / 86400000);
                  return (
                    <tr key={inv.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">{inv.number}</td>
                      <td className="px-4 py-3 truncate max-w-[200px]">{client?.name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(inv.issueDate).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3 text-xs">
                        {new Date(inv.dueDate).toLocaleDateString("pt-BR")}
                        {inv.status === "enviada" && daysLeft >= 0 && daysLeft <= 7 && <span className="ml-2 text-warning">em {daysLeft}d</span>}
                        {inv.status === "vencida" && <span className="ml-2 text-destructive">{Math.abs(daysLeft)}d atraso</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatBRL(invoiceTotal(inv))}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className={m.className}>{m.label}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        {(inv.status === "enviada" || inv.status === "vencida") && (
                          <Button size="sm" variant="ghost" onClick={() => invoicesStore.markPaid(inv.id)} className="text-xs h-7">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Marcar paga
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function KPI({ label, value, sub, trend, icon: Icon, tone }: { label: string; value: string; sub?: string; trend?: string; icon: any; tone: "success" | "info" | "destructive" }) {
  const bg = { success: "bg-success/10 text-success", info: "bg-info/10 text-info", destructive: "bg-destructive/10 text-destructive" }[tone];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${bg}`}><Icon className="h-4 w-4" /></div>
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
        {sub && <span>{sub}</span>}
        {trend && <span className="text-success font-medium">{trend}</span>}
      </div>
    </Card>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "destructive" | "success" }) {
  const cls = tone === "destructive" ? "text-destructive" : tone === "success" ? "text-success" : "";
  return (
    <div className="rounded bg-muted/50 px-2 py-1.5">
      <div className="text-muted-foreground uppercase tracking-wide text-[9px]">{label}</div>
      <div className={`font-semibold tabular-nums text-xs ${cls}`}>{value}</div>
    </div>
  );
}
