import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useStock, materials, categories, clinics, balanceOf, brl } from "@/lib/stock";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/materiais")({
  head: () => ({ meta: [
    { title: "Materiais e Produtos | Grupo Sorrisos" },
    { name: "description", content: "Cadastro de materiais odontológicos, EPIs, descartáveis e equipamentos com saldo por clínica." },
    { property: "og:title", content: "Materiais e Produtos | Grupo Sorrisos" },
    { property: "og:description", content: "Cadastro de materiais com saldo por clínica." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: MateriaisPage,
});

function MateriaisPage() {
  const s = useStock();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todas");
  const [clinic, setClinic] = useState("all");
  const rows = useMemo(() => materials.filter(mt =>
    (cat === "Todas" || mt.category === cat) && `${mt.name} ${mt.code} ${mt.sku} ${mt.brand}`.toLowerCase().includes(q.toLowerCase())), [q, cat]);

  return (
    <AppShell title="Materiais e Produtos" subtitle={`${materials.length} itens cadastrados`} primaryAction={null}>
      <div className="p-4 md:p-8 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome, código, SKU ou marca..." className="pl-9" />
          </div>
          <select value={cat} onChange={e => setCat(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option>Todas</option>{categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={clinic} onChange={e => setClinic(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">Todas as unidades</option>{clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
              <tr>{["Código", "Material", "Categoria", "Unidade", "Custo", "Saldo", "Mín / Máx", "Situação"].map(h => <th key={h} className="text-left font-medium px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(mt => {
                const qty = balanceOf(s, mt.id, clinic === "all" ? undefined : clinic);
                const min = clinic === "all" ? mt.min * clinics.length : mt.min;
                const st = qty === 0 ? { l: "Sem estoque", c: "bg-destructive/10 text-destructive border-destructive/30" } : qty < min ? { l: "Abaixo do mínimo", c: "bg-warning/10 text-warning border-warning/30" } : { l: "Normal", c: "bg-success/10 text-success border-success/30" };
                return (
                  <tr key={mt.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{mt.code}</td>
                    <td className="px-4 py-3"><div className="font-medium">{mt.name}</div><div className="text-xs text-muted-foreground">{mt.brand} · {mt.sku}</div></td>
                    <td className="px-4 py-3 text-muted-foreground">{mt.category}</td>
                    <td className="px-4 py-3">{mt.unit}</td>
                    <td className="px-4 py-3">{brl(mt.cost)}</td>
                    <td className="px-4 py-3 font-semibold">{qty}</td>
                    <td className="px-4 py-3 text-muted-foreground">{min} / {clinic === "all" ? mt.max * clinics.length : mt.max}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className={st.c}>{st.l}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
