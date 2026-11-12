import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StockStat } from "@/components/stock-ui";
import { useStock, getMaterial, getClinic, daysUntil } from "@/lib/stock";
import { useSession } from "@/lib/erp";
import { CalendarX, CalendarClock, CalendarCheck, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChartCard, tooltipStyle, axisProps } from "@/components/stock-ui";
import { NewLotWizard } from "@/components/stock-wizards";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";

export const Route = createFileRoute("/lotes-validades")({
  head: () => ({ meta: [
    { title: "Lotes e Validades | Grupo Sorrisos" },
    { name: "description", content: "Controle de lotes e datas de validade dos materiais em cada clínica." },
    { property: "og:title", content: "Lotes e Validades | Grupo Sorrisos" },
    { property: "og:description", content: "Controle de lotes e validades por clínica." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: LotesPage,
});

function status(d: number) {
  if (d < 0) return { l: "Vencido", c: "bg-destructive/10 text-destructive border-destructive/30" };
  if (d <= 60) return { l: `Vence em ${d} dias`, c: "bg-warning/10 text-warning border-warning/30" };
  return { l: "Válido", c: "bg-success/10 text-success border-success/30" };
}

function LotesPage() {
  const s = useStock();
  const ses = useSession();
  const lots = s.lots.filter(l => ses.scope.includes(l.clinicId)).sort((a, b) => a.expires.localeCompare(b.expires));
  const exp = lots.filter(l => daysUntil(l.expires) < 0).length;
  const soon = lots.filter(l => { const d = daysUntil(l.expires); return d >= 0 && d <= 60; }).length;
  const [open, setOpen] = useState(false);
  const buckets = [["Vencidos", (d: number) => d < 0, "var(--destructive)"], ["0–30 dias", (d: number) => d >= 0 && d <= 30, "var(--warning)"], ["31–60", (d: number) => d > 30 && d <= 60, "var(--warning)"], ["61–90", (d: number) => d > 60 && d <= 90, "var(--info)"], ["91–180", (d: number) => d > 90 && d <= 180, "var(--chart-1)"], ["> 180", (d: number) => d > 180, "var(--success)"]] as const;
  const curve = buckets.map(([name, f, color]) => ({ name, color, qtd: lots.filter(l => f(daysUntil(l.expires))).reduce((a, l) => a + l.qty, 0) }));
  return (
    <AppShell title="Lotes e Validades" subtitle="Ordenado pelo vencimento mais próximo" primaryAction={ses.can("estoque.movimentar") ? <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Novo Lote</Button> : null}>
      <div className="p-4 md:p-8 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StockStat label="Lotes vencidos" value={exp} icon={CalendarX} tone="destructive" />
          <StockStat label="Vencem em até 60 dias" value={soon} icon={CalendarClock} tone="warning" />
          <StockStat label="Lotes válidos" value={lots.length - exp - soon} icon={CalendarCheck} tone="success" />
        </div>
        <ChartCard title="Curva de vencimento" desc="Unidades por faixa de validade">
          <ResponsiveContainer><BarChart data={curve}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" {...axisProps} /><YAxis {...axisProps} width={30} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} /><Bar dataKey="qtd" name="Unidades" radius={[6, 6, 0, 0]}>{curve.map(c => <Cell key={c.name} fill={c.color} />)}</Bar></BarChart></ResponsiveContainer>
        </ChartCard>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
              <tr>{["Lote", "Material", "Clínica", "Quantidade", "Validade", "Situação"].map(h => <th key={h} className="text-left font-medium px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lots.map(l => { const st = status(daysUntil(l.expires)); return (
                <tr key={l.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{l.lot}</td>
                  <td className="px-4 py-3 font-medium">{getMaterial(l.materialId).name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{getClinic(l.clinicId).name}</td>
                  <td className="px-4 py-3">{l.qty}</td>
                  <td className="px-4 py-3">{l.expires.split("-").reverse().join("/")}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className={st.c}>{st.l}</Badge></td>
                </tr>
              ); })}
            </tbody>
          </table>
        </Card>
      </div>
      {open && <NewLotWizard open onClose={() => setOpen(false)} />}
    </AppShell>
  );
}
