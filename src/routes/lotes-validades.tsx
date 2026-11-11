import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StockStat } from "@/components/stock-ui";
import { useStock, getMaterial, getClinic, daysUntil } from "@/lib/stock";
import { CalendarX, CalendarClock, CalendarCheck } from "lucide-react";

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
  const lots = [...s.lots].sort((a, b) => a.expires.localeCompare(b.expires));
  const exp = lots.filter(l => daysUntil(l.expires) < 0).length;
  const soon = lots.filter(l => { const d = daysUntil(l.expires); return d >= 0 && d <= 60; }).length;
  return (
    <AppShell title="Lotes e Validades" subtitle="Ordenado pelo vencimento mais próximo" primaryAction={null}>
      <div className="p-4 md:p-8 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StockStat label="Lotes vencidos" value={exp} icon={CalendarX} tone="destructive" />
          <StockStat label="Vencem em até 60 dias" value={soon} icon={CalendarClock} tone="warning" />
          <StockStat label="Lotes válidos" value={lots.length - exp - soon} icon={CalendarCheck} tone="success" />
        </div>
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
    </AppShell>
  );
}
