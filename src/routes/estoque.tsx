import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StockStat } from "@/components/stock-ui";
import { useStock, materials, clinics, balanceOf, brl, daysUntil, getMaterial, getClinic } from "@/lib/stock";
import { Package, Wallet, AlertTriangle, CalendarX, PackageX, Truck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

export const Route = createFileRoute("/estoque")({
  head: () => ({ meta: [
    { title: "Visão Geral do Estoque | Grupo Sorrisos" },
    { name: "description", content: "Indicadores de estoque consolidados de todas as clínicas do Grupo Sorrisos." },
    { property: "og:title", content: "Visão Geral do Estoque | Grupo Sorrisos" },
    { property: "og:description", content: "Indicadores de estoque consolidados de todas as clínicas." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: EstoquePage,
});

function EstoquePage() {
  const s = useStock();
  const value = s.balances.reduce((a, b) => a + b.qty * getMaterial(b.materialId).cost, 0);
  const below = materials.filter(mt => clinics.some(c => balanceOf(s, mt.id, c.id) < mt.min / 2 && c.id !== "cd"));
  const zero = s.balances.filter(b => b.qty === 0).length;
  const expiring = s.lots.filter(l => { const d = daysUntil(l.expires); return d >= 0 && d <= 60; });
  const pending = s.transfers.filter(t => t.status !== "concluida").length;
  const byClinic = clinics.filter(c => c.id !== "cd").map(c => ({
    name: c.name.replace("Sorrisos ", ""),
    Entradas: s.movements.filter(mv => (mv.type === "entrada" && mv.clinicId === c.id) || mv.toClinicId === c.id).reduce((a, mv) => a + mv.qty, 0),
    Saídas: s.movements.filter(mv => mv.type === "saida" && mv.clinicId === c.id).reduce((a, mv) => a + mv.qty, 0),
  }));

  return (
    <AppShell title="Visão Geral do Estoque" subtitle="Consolidado de todas as unidades" primaryAction={null}>
      <div className="p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-3">
          <StockStat label="Materiais" value={materials.length} icon={Package} />
          <StockStat label="Valor em estoque" value={brl(value)} icon={Wallet} tone="success" />
          <StockStat label="Abaixo do mínimo" value={below.length} icon={AlertTriangle} tone="warning" />
          <StockStat label="Vencendo (60 dias)" value={expiring.length} icon={CalendarX} tone="destructive" />
          <StockStat label="Saldos zerados" value={zero} icon={PackageX} tone="destructive" />
          <StockStat label="Transferências pendentes" value={pending} icon={Truck} tone="info" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="font-semibold mb-4">Entradas x Saídas por clínica</div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byClinic}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Legend />
                  <Bar dataKey="Entradas" fill="var(--success)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Saídas" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4"><div className="font-semibold">Alertas de reposição</div><Link to="/materiais" className="text-xs text-primary">Ver materiais</Link></div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {below.length === 0 && <div className="text-sm text-muted-foreground">Nenhum alerta.</div>}
              {below.map(mt => (
                <div key={mt.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                  <div className="min-w-0"><div className="truncate font-medium">{mt.name}</div><div className="text-xs text-muted-foreground">Mín. {mt.min} {mt.unit}</div></div>
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Repor</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4"><div className="font-semibold">Últimas movimentações</div><Link to="/movimentacoes" className="text-xs text-primary">Ver todas</Link></div>
          <div className="divide-y divide-border">
            {s.movements.slice(0, 6).map(mv => (
              <div key={mv.id} className="py-2 flex items-center gap-3 text-sm">
                <Badge variant="outline" className="capitalize w-28 justify-center">{mv.type}</Badge>
                <div className="flex-1 truncate">{getMaterial(mv.materialId).name}</div>
                <div className="text-muted-foreground hidden md:block">{getClinic(mv.clinicId).name}</div>
                <div className="font-medium w-16 text-right">{mv.type === "saida" ? "-" : "+"}{mv.qty}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
