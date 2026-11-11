import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStock, transferFlow, transferLabels, advanceTransfer, getClinic, getMaterial } from "@/lib/stock";
import { ArrowRight } from "lucide-react";

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
  return (
    <AppShell title="Transferências" subtitle="Solicitação → Aprovação → Separação → Trânsito → Recebimento" primaryAction={null}>
      <div className="p-4 md:p-8 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {transferFlow.map(st => {
            const items = s.transfers.filter(t => t.status === st);
            return (
              <div key={st} className="w-72 shrink-0 rounded-lg bg-muted/40 p-3">
                <div className="flex items-center justify-between mb-3 px-1"><div className="text-sm font-semibold">{transferLabels[st]}</div><span className="text-xs text-muted-foreground">{items.length}</span></div>
                <div className="space-y-2">
                  {items.map(t => (
                    <Card key={t.id} className="p-3 space-y-2">
                      <div className="flex items-center justify-between"><span className="font-mono text-xs">{t.number}</span><span className="text-xs text-muted-foreground">{t.date.split("-").reverse().join("/")}</span></div>
                      <div className="text-sm flex items-center gap-1 flex-wrap">{getClinic(t.fromId).name}<ArrowRight className="h-3 w-3" />{getClinic(t.toId).name}</div>
                      <ul className="text-xs text-muted-foreground">{t.items.map(i => <li key={i.materialId}>{i.qty}× {getMaterial(i.materialId).name}</li>)}</ul>
                      {st !== "concluida" && <Button size="sm" variant="outline" className="w-full" onClick={() => advanceTransfer(t.id)}>Avançar para {transferLabels[transferFlow[transferFlow.indexOf(st) + 1]]}</Button>}
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
