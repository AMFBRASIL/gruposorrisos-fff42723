import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStock, getMaterial, getClinic, brl, type MovementType } from "@/lib/stock";
import { StockStat, ChartCard, tooltipStyle, axisProps } from "@/components/stock-ui";
import { NewMovementWizard } from "@/components/stock-wizards";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/lib/erp";

export const Route = createFileRoute("/movimentacoes")({
  head: () => ({ meta: [
    { title: "Movimentações de Estoque | Grupo Sorrisos" },
    { name: "description", content: "Entradas, saídas e transferências de materiais entre as clínicas do Grupo Sorrisos." },
    { property: "og:title", content: "Movimentações de Estoque | Grupo Sorrisos" },
    { property: "og:description", content: "Entradas, saídas e transferências de materiais." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: MovPage,
});

const typeMeta: Record<MovementType, { label: string; icon: typeof Plus; cls: string; reasons: string[] }> = {
  entrada: { label: "Entrada", icon: ArrowDownToLine, cls: "bg-success/10 text-success border-success/30", reasons: ["Compra", "Devolução", "Ajuste autorizado", "Saldo inicial"] },
  saida: { label: "Saída", icon: ArrowUpFromLine, cls: "bg-destructive/10 text-destructive border-destructive/30", reasons: ["Consumo", "Perda", "Descarte", "Ajuste autorizado"] },
  transferencia: { label: "Transferência", icon: ArrowLeftRight, cls: "bg-info/10 text-info border-info/30", reasons: ["Entre clínicas", "Entre depósitos"] },
};

function MovPage() {
  const s = useStock();
  const [filter, setFilter] = useState<MovementType | "todas">("todas");
  const [open, setOpen] = useState(false);
  const ses = useSession();
  const rows = s.movements.filter(mv => (filter === "todas" || mv.type === filter) && (ses.scope.includes(mv.clinicId) || (mv.toClinicId !== undefined && ses.scope.includes(mv.toClinicId))));
  const scoped = s.movements.filter(mv => ses.scope.includes(mv.clinicId) || (mv.toClinicId !== undefined && ses.scope.includes(mv.toClinicId)));
  const sum = (t: MovementType) => scoped.filter(m => m.type === t).reduce((a, m) => a + m.qty, 0);
  const value = scoped.reduce((a, m) => a + m.qty * getMaterial(m.materialId).cost, 0);
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(Date.UTC(2026, 10, 11 - 13 + i)).toISOString().slice(0, 10); const of = (t: MovementType) => scoped.filter(m => m.date === d && m.type === t).reduce((a, m) => a + m.qty, 0); return { name: d.slice(8, 10) + "/" + d.slice(5, 7), Entradas: of("entrada"), Saídas: of("saida"), Transferências: of("transferencia") }; });
  return (
    <AppShell title="Movimentações" subtitle="Entradas, saídas e transferências" primaryAction={ses.can("estoque.movimentar") && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova Movimentação</Button> || null}>
      <div className="p-4 md:p-8 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StockStat label="Entradas (un)" value={sum("entrada")} icon={ArrowDownToLine} tone="success" />
          <StockStat label="Saídas (un)" value={sum("saida")} icon={ArrowUpFromLine} tone="destructive" />
          <StockStat label="Transferidas (un)" value={sum("transferencia")} icon={ArrowLeftRight} tone="info" />
          <StockStat label="Valor movimentado" value={brl(value)} icon={Wallet} hint={`${scoped.length} lançamentos`} />
        </div>
        <ChartCard title="Fluxo de estoque" desc="Unidades movimentadas nos últimos 14 dias">
          <ResponsiveContainer><BarChart data={days}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" {...axisProps} /><YAxis {...axisProps} width={30} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="Entradas" stackId="a" fill="var(--success)" /><Bar dataKey="Saídas" stackId="a" fill="var(--destructive)" /><Bar dataKey="Transferências" stackId="a" fill="var(--info)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
          {(["todas", "entrada", "saida", "transferencia"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 h-8 rounded-md text-xs transition-colors ${filter === f ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}>{f === "todas" ? "Todas" : typeMeta[f].label}</button>
          ))}
        </div>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
              <tr>{["Número", "Tipo", "Material", "Origem", "Destino", "Qtd", "Motivo", "Responsável", "Data"].map(h => <th key={h} className="text-left font-medium px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(mv => { const t = typeMeta[mv.type]; return (
                <tr key={mv.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{mv.number}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className={t.cls}>{t.label}</Badge></td>
                  <td className="px-4 py-3 font-medium">{getMaterial(mv.materialId).name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{getClinic(mv.clinicId).name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{mv.toClinicId ? getClinic(mv.toClinicId).name : "—"}</td>
                  <td className="px-4 py-3 font-semibold">{mv.qty}</td>
                  <td className="px-4 py-3">{mv.reason}</td>
                  <td className="px-4 py-3">{mv.user}</td>
                  <td className="px-4 py-3 text-muted-foreground">{mv.date.split("-").reverse().join("/")}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </Card>
      </div>
      {open && <NewMovementWizard open onClose={() => setOpen(false)} />}
    </AppShell>
  );
}

