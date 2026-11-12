import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErp, useSession } from "@/lib/erp";
import { useStock, materials, balanceOf, applyDelta, logMovement, brl } from "@/lib/stock";

export const Route = createFileRoute("/inventarios")({
  head: () => ({ meta: [
    { title: "Inventários | Grupo Sorrisos" },
    { name: "description", content: "Contagem física de estoque por filial com conciliação de diferenças." },
    { property: "og:title", content: "Inventários | Grupo Sorrisos" },
    { property: "og:description", content: "Inventário por filial com ajuste de diferenças." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: InvPage,
});

function InvPage() {
  const erp = useErp(); const ses = useSession(); const st = useStock();
  const branches = erp.branches.filter(b => b.type !== "administracao" && ses.visible.includes(b.id));
  const [branchId, setBranch] = useState(ses.filter !== "all" ? ses.filter : branches[0]?.id ?? "");
  const [count, setCount] = useState<Record<string, string>>({});
  const allowed = ses.can("inventario.realizar", branchId);
  const diffs = materials.map(m => ({ m, sys: balanceOf(st, m.id, branchId), cnt: count[m.id] === undefined || count[m.id] === "" ? null : Number(count[m.id]) })).map(r => ({ ...r, diff: r.cnt === null ? 0 : r.cnt - r.sys }));
  const changed = diffs.filter(d => d.diff !== 0);
  const apply = () => {
    if (!allowed) return toast.error("Sem permissão para inventariar esta filial");
    for (const d of changed) { applyDelta(d.m.id, branchId, d.diff); logMovement({ type: d.diff > 0 ? "entrada" : "saida", reason: "Ajuste de inventário", materialId: d.m.id, clinicId: branchId, qty: Math.abs(d.diff), user: ses.user.name }); }
    toast.success(`${changed.length} ajuste(s) lançados`); setCount({});
  };
  return (
    <AppShell title="Inventários" subtitle="Informe a contagem física; as diferenças viram ajustes de estoque" primaryAction={allowed && changed.length > 0 ? <Button size="sm" onClick={apply}>Concluir inventário ({changed.length})</Button> : null}>
      <div className="p-4 md:p-8 space-y-4">
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={branchId} onChange={e => { setBranch(e.target.value); setCount({}); }}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        {!allowed && <div className="rounded-md border border-warning/30 bg-warning/10 text-sm p-3">Seu perfil não pode inventariar esta filial (somente consulta).</div>}
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide"><tr>{["Material", "Saldo do sistema", "Contagem", "Diferença", "Impacto"].map(h => <th key={h} className="text-left font-medium px-4 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {diffs.map(d => <tr key={d.m.id}>
                <td className="px-4 py-2 font-medium">{d.m.name}</td><td className="px-4 py-2">{d.sys} {d.m.unit}</td>
                <td className="px-4 py-2"><Input type="number" min={0} disabled={!allowed} className="h-8 w-24" value={count[d.m.id] ?? ""} onChange={e => setCount({ ...count, [d.m.id]: e.target.value })} /></td>
                <td className={`px-4 py-2 font-medium ${d.diff < 0 ? "text-destructive" : d.diff > 0 ? "text-success" : ""}`}>{d.diff > 0 ? "+" : ""}{d.diff}</td>
                <td className="px-4 py-2 text-muted-foreground">{brl(d.diff * d.m.cost)}</td>
              </tr>)}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
