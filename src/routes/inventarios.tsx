import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StockStat, ChartCard, tooltipStyle, axisProps } from "@/components/stock-ui";
import { NewInventoryWizard } from "@/components/stock-wizards";
import { useStock, getClinic, brl, daysUntil, clinics, useStockSession } from "@/lib/stock-live";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Plus, ClipboardCheck, Target, TrendingDown, TrendingUp, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/inventarios")({
  head: () => ({ meta: [
    { title: "Inventários | Grupo Sorrisos" },
    { name: "description", content: "Inventário completo ou cíclico por filial, com contagem cega e conciliação automática." },
    { property: "og:title", content: "Inventários | Grupo Sorrisos" },
    { property: "og:description", content: "Inventário por filial com ajuste de diferenças." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: InvPage,
});

function InvPage() {
  const st = useStock(); const ses = useStockSession();
  const [open, setOpen] = useState(false);
  const list = st.inventories.filter(i => ses.scope.includes(i.branchId)).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  const counted = list.reduce((a, i) => a + i.counted, 0);
  const divs = list.reduce((a, i) => a + i.divergences, 0);
  const accuracy = counted ? Math.round(((counted - divs) / counted) * 100) : 100;
  const chart = list.slice().reverse().map(i => ({ name: i.number, Sobras: Math.round(i.valueIn), Faltas: Math.round(i.valueOut) }));
  const overdue = clinics.filter(c => ses.visible.includes(c.id) && !list.some(i => i.branchId === c.id && daysUntil(i.date) > -30));
  return (
    <AppShell title="Inventários" subtitle="Contagem completa ou cíclica com conciliação automática" primaryAction={ses.can("inventario.realizar") ? <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Novo Inventário</Button> : null}>
      <div className="p-4 md:p-8 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StockStat label="Inventários realizados" value={list.length} icon={ClipboardCheck} hint={`${counted} itens contados`} />
          <StockStat label="Acurácia de estoque" value={`${accuracy}%`} icon={Target} tone="success" hint="itens sem divergência" />
          <StockStat label="Sobras ajustadas" value={brl(list.reduce((a, i) => a + i.valueIn, 0))} icon={TrendingUp} tone="info" />
          <StockStat label="Faltas ajustadas" value={brl(list.reduce((a, i) => a + i.valueOut, 0))} icon={TrendingDown} tone="destructive" />
        </div>
        {overdue.length > 0 && <Card className="p-4 border-warning/30 bg-warning/5 flex flex-wrap items-center gap-2 text-sm"><CalendarClock className="h-4 w-4 text-warning" /><span className="font-semibold">Sem inventário nos últimos 30 dias:</span>{overdue.map(c => <Badge key={c.id} variant="outline">{c.name}</Badge>)}</Card>}
        <ChartCard title="Impacto financeiro por inventário" desc="Valor de sobras e faltas ajustadas">
          <ResponsiveContainer><BarChart data={chart}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" {...axisProps} /><YAxis {...axisProps} width={50} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v: number) => brl(v)} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="Sobras" fill="var(--success)" radius={[6, 6, 0, 0]} /><Bar dataKey="Faltas" fill="var(--destructive)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide"><tr>{["Número", "Filial", "Escopo", "Itens", "Divergências", "Sobras", "Faltas", "Responsável", "Data"].map(h => <th key={h} className="text-left font-medium px-4 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {list.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">Nenhum inventário ainda.</td></tr>}
              {list.map(i => <tr key={i.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs font-semibold">{i.number}</td><td className="px-4 py-3 font-medium">{getClinic(i.branchId).name}</td>
                <td className="px-4 py-3"><Badge variant="outline">{i.scope}{i.blind ? " · cega" : ""}</Badge></td><td className="px-4 py-3">{i.counted}</td>
                <td className="px-4 py-3">{i.divergences}</td><td className="px-4 py-3 text-success">{brl(i.valueIn)}</td><td className="px-4 py-3 text-destructive">{brl(i.valueOut)}</td>
                <td className="px-4 py-3">{i.user}</td><td className="px-4 py-3 text-muted-foreground">{i.date.split("-").reverse().join("/")}</td>
              </tr>)}
            </tbody>
          </table>
        </Card>
      </div>
      {open && <NewInventoryWizard open onClose={() => setOpen(false)} />}
    </AppShell>
  );
}
