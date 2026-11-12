import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useStock, materials, categories, clinics, balanceOf, brl } from "@/lib/stock";
import { Search, Plus, Package, AlertTriangle, PackageX, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StockStat, ChartCard, chartColors, tooltipStyle, axisProps } from "@/components/stock-ui";
import { NewMaterialWizard } from "@/components/stock-wizards";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts";
import { useMemo, useState } from "react";
import { useSession } from "@/lib/erp";

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
  const ses = useSession();
  const [localClinic, setClinic] = useState("all");
  const clinic = ses.filter !== "all" ? ses.filter : localClinic;
  const [open, setOpen] = useState(false);
  const cid = clinic === "all" ? undefined : clinic;
  const info = materials.map(mt => { const qty = balanceOf(s, mt.id, cid); const min = cid ? mt.min : mt.min * clinics.length; return { mt, qty, min, st: qty === 0 ? 2 : qty < min ? 1 : 0 }; });
  const stockValue = info.reduce((a, r) => a + r.qty * r.mt.cost, 0);
  const byCat = categories.map(c => ({ name: c.replace("Materiais odontológicos", "Odontológicos"), valor: Math.round(info.filter(r => r.mt.category === c).reduce((a, r) => a + r.qty * r.mt.cost, 0)) })).filter(x => x.valor > 0).sort((a, b) => b.valor - a.valor);
  const health = [{ name: "Normal", value: info.filter(r => r.st === 0).length }, { name: "Abaixo do mínimo", value: info.filter(r => r.st === 1).length }, { name: "Sem estoque", value: info.filter(r => r.st === 2).length }];
  const rows = useMemo(() => materials.filter(mt =>
    (cat === "Todas" || mt.category === cat) && `${mt.name} ${mt.code} ${mt.sku} ${mt.brand} ${mt.barcode || ""} ${mt.manufacturer || ""}`.toLowerCase().includes(q.toLowerCase())), [q, cat, s]);

  return (
    <AppShell title="Materiais e Produtos" subtitle={`${materials.length} itens cadastrados`} primaryAction={ses.can("estoque.movimentar") ? <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Novo Material</Button> : null}>
      <div className="p-4 md:p-8 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StockStat label="Itens no catálogo" value={materials.length} icon={Package} hint={`${categories.length} categorias`} />
          <StockStat label="Valor em estoque" value={brl(stockValue)} icon={Wallet} tone="success" />
          <StockStat label="Abaixo do mínimo" value={health[1].value} icon={AlertTriangle} tone="warning" />
          <StockStat label="Sem estoque" value={health[2].value} icon={PackageX} tone="destructive" />
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <ChartCard className="lg:col-span-2" title="Valor em estoque por categoria" desc="Custo × saldo">
            <ResponsiveContainer><BarChart data={byCat}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" {...axisProps} interval={0} angle={-15} textAnchor="end" height={45} /><YAxis {...axisProps} width={60} tickFormatter={v => `R$${Math.round(v / 1000)}k`} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v: number) => brl(v)} /><Bar dataKey="valor" radius={[6, 6, 0, 0]}>{byCat.map((_, i) => <Cell key={i} fill={chartColors[i % 5]} />)}</Bar></BarChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Saúde do estoque" desc="Situação dos itens">
            <ResponsiveContainer><PieChart><Pie data={health} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}><Cell fill="var(--success)" /><Cell fill="var(--warning)" /><Cell fill="var(--destructive)" /></Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer>
          </ChartCard>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome, código, SKU ou marca..." className="pl-9" />
          </div>
          <select value={cat} onChange={e => setCat(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option>Todas</option>{categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={clinic} onChange={e => setClinic(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">Todas as unidades</option>{clinics.filter(c => ses.visible.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                    <td className="px-4 py-3"><div className="font-medium">{mt.name}</div><div className="text-xs text-muted-foreground">{mt.manufacturer || mt.brand} · {mt.barcode || mt.sku}</div></td>
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
      {open && <NewMaterialWizard open onClose={() => setOpen(false)} />}
    </AppShell>
  );
}
