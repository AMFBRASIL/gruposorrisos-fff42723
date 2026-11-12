import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStock, transferFlow, transferLabels, advanceTransfer, getClinic, getMaterial } from "@/lib/stock";
import { useSession } from "@/lib/erp";
import { ArrowRight, Plus, Send, Truck, CheckCircle2, Boxes } from "lucide-react";
import { useState } from "react";
import { StockStat, ChartCard, tooltipStyle, axisProps } from "@/components/stock-ui";
import { NewTransferWizard } from "@/components/stock-wizards";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export const Route = createFileRoute("/transferencias")({
  head: () => ({ meta: [
    { title: "Transferências | Grupo Sorrisos" },
    { name: "description", content: "Acompanhe transferências de materiais entre clínicas: aprovação, separação, trânsito e recebimento." },
    { property: "og:title", content: "Transferências | Grupo Sorrisos" },
    { property: "og:description", content: "Fluxo de transferências de materiais entre clínicas." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: TransfPage,
});

function TransfPage() {
  const s = useStock();
  const ses = useSession();
  const [open, setOpen] = useState(false);
  const scoped = s.transfers.filter(t => ses.scope.includes(t.fromId) || ses.scope.includes(t.toId));
  const c = (f: (t: typeof scoped[number]) => boolean) => scoped.filter(f).length;
  const units = scoped.reduce((a, t) => a + t.items.reduce((b, i) => b + i.qty, 0), 0);
  const byStage = transferFlow.map(st => ({ name: transferLabels[st], total: c(t => t.status === st) }));
  return (
    <AppShell title="Transferências" subtitle="Solicitação → Aprovação → Separação → Trânsito → Recebimento" primaryAction={ses.can("estoque.movimentar") ? <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nova Transferência</Button> : null}>
      <div className="p-4 md:p-8 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StockStat label="Solicitadas" value={c(t => t.status === "solicitada" || t.status === "aprovada")} icon={Send} tone="warning" />
          <StockStat label="Em trânsito" value={c(t => t.status === "separacao" || t.status === "transito")} icon={Truck} tone="info" />
          <StockStat label="Concluídas" value={c(t => t.status === "recebida" || t.status === "concluida")} icon={CheckCircle2} tone="success" />
          <StockStat label="Unidades transferidas" value={units} icon={Boxes} />
        </div>
        <ChartCard title="Transferências por etapa" desc="Gargalos do fluxo logístico">
          <ResponsiveContainer><BarChart data={byStage}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" {...axisProps} /><YAxis {...axisProps} width={24} allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} /><Bar dataKey="total" fill="var(--chart-2)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max">
          {transferFlow.map(st => {
            const items = s.transfers.filter(t => t.status === st && (ses.scope.includes(t.fromId) || ses.scope.includes(t.toId)));
            return (
              <div key={st} className="w-72 shrink-0 rounded-lg bg-muted/40 p-3">
                <div className="flex items-center justify-between mb-3 px-1"><div className="text-sm font-semibold">{transferLabels[st]}</div><span className="text-xs text-muted-foreground">{items.length}</span></div>
                <div className="space-y-2">
                  {items.map(t => (
                    <Card key={t.id} className="p-4 space-y-2 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between"><span className="font-mono text-xs">{t.number}</span><span className="text-xs text-muted-foreground">{t.date.split("-").reverse().join("/")}</span></div>
                      <div className="text-sm flex items-center gap-1 flex-wrap">{getClinic(t.fromId).name}<ArrowRight className="h-3 w-3" />{getClinic(t.toId).name}</div>
                      <ul className="text-xs text-muted-foreground">{t.items.map(i => <li key={i.materialId}>{i.qty}× {getMaterial(i.materialId).name}</li>)}</ul>
                      {st !== "concluida" && ses.can("estoque.movimentar") && <Button size="sm" variant="outline" className="w-full" onClick={() => advanceTransfer(t.id)}>Avançar para {transferLabels[transferFlow[transferFlow.indexOf(st) + 1]]}</Button>}
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
      {open && <NewTransferWizard open onClose={() => setOpen(false)} />}
    </AppShell>
  );
}
