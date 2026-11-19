import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StockStat, ChartCard, chartColors, tooltipStyle, axisProps } from "@/components/stock-ui";
import { useStock, materials, clinics, categories, balanceOf, brl, daysUntil, getMaterial, getClinic, useStockSession, stockInsights, stockAlerts, transferLabels } from "@/lib/stock-live";
import { Package, Wallet, AlertTriangle, CalendarX, PackageX, Truck, Lock, ArrowDownToLine, Boxes, Activity, ClipboardCheck, Timer } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, PieChart, Pie, Cell } from "recharts";

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

const dayKey = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const shortName = (name: string) => name.replace("Grupo Sorrisos · ", "").replace("Sorrisos ", "");

function EstoquePage() {
  const st = useStock();
  const ses = useStockSession();
  const view = useMemo(() => {
    const scope = new Set(ses.scope);
    const balances = st.balances.filter((row) => scope.has(row.clinicId));
    const lots = st.lots.filter((lot) => scope.has(lot.clinicId) && lot.qty > 0);
    const movements = st.movements.filter((row) => scope.has(row.clinicId) || (row.toClinicId ? scope.has(row.toClinicId) : false));
    const transfers = st.transfers.filter((row) => scope.has(row.fromId) || scope.has(row.toId));
    const inventories = st.inventories.filter((row) => scope.has(row.branchId));
    const insights = stockInsights(ses.scope);
    const units = clinics.filter((clinic) => scope.has(clinic.id));
    const since = dayKey(-29);
    const outs = movements.filter((row) => row.type === "saida" && row.date.slice(0, 10) >= since);
    const value = balances.reduce((sum, row) => sum + row.qty * getMaterial(row.materialId).cost, 0);
    const availableValue = insights.reduce((sum, row) => sum + row.available * row.material.cost, 0);
    const reservedValue = balances.reduce((sum, row) => sum + row.reserved * getMaterial(row.materialId).cost, 0);
    const incoming = insights.reduce((sum, row) => sum + row.incoming, 0);
    const replenish = insights.filter((row) => row.replenish > 0);
    const replenishValue = replenish.reduce((sum, row) => sum + row.replenish * row.material.cost, 0);
    const coverages = insights.flatMap((row) => row.coverage == null ? [] : [row.coverage]);
    const coverage = coverages.length ? Math.round(coverages.reduce((sum, days) => sum + days, 0) / coverages.length) : null;
    const byUnit = units.map((clinic) => {
      const rows = balances.filter((row) => row.clinicId === clinic.id);
      return {
        name: shortName(clinic.name),
        Valor: Math.round(rows.reduce((sum, row) => sum + row.qty * getMaterial(row.materialId).cost, 0)),
        Disponível: Math.round(rows.reduce((sum, row) => sum + Math.max(0, row.qty - row.reserved) * getMaterial(row.materialId).cost, 0)),
      };
    });
    const flow = Array.from({ length: 14 }, (_, index) => {
      const key = dayKey(index - 13);
      const rows = movements.filter((row) => row.date.slice(0, 10) === key);
      return {
        name: key.slice(8),
        Entradas: rows.filter((row) => row.type === "entrada").reduce((sum, row) => sum + row.qty, 0),
        Saídas: rows.filter((row) => row.type === "saida").reduce((sum, row) => sum + row.qty, 0),
      };
    });
    const byCategory = categories.map((category) => ({
      name: category.replace("Materiais odontológicos", "Odontológicos"),
      valor: Math.round(materials.filter((item) => item.category === category).reduce((sum, item) => sum + balanceOf({ balances }, item.id) * item.cost, 0)),
    })).filter((row) => row.valor > 0).sort((a, b) => b.valor - a.valor);
    const health = [
      { name: "Normal", value: insights.filter((row) => row.qty > 0 && row.available >= row.material.min).length },
      { name: "Abaixo do mínimo", value: insights.filter((row) => row.qty > 0 && row.available < row.material.min).length },
      { name: "Sem saldo", value: insights.filter((row) => row.qty <= 0).length },
    ];
    const ranking = materials.map((item) => ({ item, qty: balanceOf({ balances }, item.id), value: balanceOf({ balances }, item.id) * item.cost }))
      .filter((row) => row.qty > 0).sort((a, b) => b.value - a.value || a.item.name.localeCompare(b.item.name)).slice(0, 6);
    return {
      balances, lots, movements, transfers, inventories, insights, value, availableValue, reservedValue, incoming, replenish, replenishValue, coverage,
      below: insights.filter((row) => row.available < row.material.min),
      zero: insights.filter((row) => row.qty <= 0).length,
      expired: lots.filter((lot) => daysUntil(lot.expires) < 0),
      expiring: lots.filter((lot) => { const days = daysUntil(lot.expires); return days >= 0 && days <= 60; }),
      pending: transfers.filter((row) => row.status !== "concluida"),
      idle: insights.filter((row) => row.idle && row.available > 0).length,
      outQty: outs.reduce((sum, row) => sum + row.qty, 0),
      alerts: stockAlerts(ses.scope).slice(0, 8),
      byUnit, flow, byCategory, health, ranking,
    };
  }, [st, ses.scope]);

  return (
    <AppShell title="Visão Geral do Estoque" subtitle={ses.filter === "all" ? "Consolidado das filiais permitidas" : "Filial selecionada no topo"} primaryAction={null}>
      <div className="p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-8 gap-3">
          <StockStat label="Materiais" value={materials.length} icon={Package} hint={`${categories.length} categorias`} />
          <StockStat label="Valor em estoque" value={brl(view.value)} icon={Wallet} tone="success" />
          <StockStat label="Disponível" value={brl(view.availableValue)} icon={Boxes} tone="success" hint="Saldo menos reserva" />
          <StockStat label="Reservado" value={brl(view.reservedValue)} icon={Lock} tone="info" />
          <StockStat label="Abaixo do mínimo" value={view.below.length} icon={AlertTriangle} tone="warning" hint={`${view.replenish.length} com reposição`} />
          <StockStat label="Saldos zerados" value={view.zero} icon={PackageX} tone="destructive" />
          <StockStat label="Validade" value={view.expired.length + view.expiring.length} icon={CalendarX} tone="destructive" hint={`${view.expired.length} vencidos · ${view.expiring.length} em 60 dias`} />
          <StockStat label="Transferências" value={view.pending.length} icon={Truck} tone="info" hint="Ainda não concluídas" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-3">
          <StockStat label="A caminho" value={view.incoming} icon={ArrowDownToLine} tone="info" hint="Sugestões de reposição abertas" />
          <StockStat label="Reposição sugerida" value={brl(view.replenishValue)} icon={AlertTriangle} tone="warning" hint={`${view.replenish.length} itens até o máximo`} />
          <StockStat label="Saídas em 30 dias" value={view.outQty} icon={Activity} hint="Quantidade movimentada" />
          <StockStat label="Cobertura média" value={view.coverage == null ? "—" : `${view.coverage} d`} icon={Timer} hint={`${view.idle} itens sem saída`} />
          <StockStat label="Lotes com saldo" value={view.lots.length} icon={Package} />
          <StockStat label="Inventários" value={view.inventories.length} icon={ClipboardCheck} hint={`${view.inventories.reduce((sum, row) => sum + row.divergences, 0)} divergências`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard className="lg:col-span-2" title="Valor por unidade" desc="Custo do saldo e do que está livre">
            <ResponsiveContainer>
              <BarChart data={view.byUnit}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" {...axisProps} interval={0} /><YAxis {...axisProps} width={64} tickFormatter={(value: number) => brl(value)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => brl(value)} />
                <Legend /><Bar dataKey="Valor" fill="var(--primary)" radius={[4, 4, 0, 0]} /><Bar dataKey="Disponível" fill="var(--success)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Saúde das posições" desc="Cada saldo de material na unidade">
            <ResponsiveContainer>
              <PieChart><Pie data={view.health} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2}><Cell fill="var(--success)" /><Cell fill="var(--warning)" /><Cell fill="var(--destructive)" /></Pie><Tooltip contentStyle={tooltipStyle} /></PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard className="lg:col-span-2" title="Entradas e saídas" desc="Últimos 14 dias, pela data do lançamento">
            <ResponsiveContainer>
              <BarChart data={view.flow}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" {...axisProps} /><YAxis {...axisProps} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} /><Legend />
                <Bar dataKey="Entradas" fill="var(--success)" radius={[4, 4, 0, 0]} /><Bar dataKey="Saídas" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Valor por categoria" desc="Custo vezes saldo visível">
            <ResponsiveContainer>
              <BarChart data={view.byCategory} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" {...axisProps} tickFormatter={(value: number) => brl(value)} /><YAxis type="category" dataKey="name" {...axisProps} width={92} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => brl(value)} />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]}>{view.byCategory.map((_, index) => <Cell key={view.byCategory[index].name} fill={chartColors[index % chartColors.length]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4"><div className="font-semibold">Alertas</div><Link to="/estoque-avancado" className="text-xs text-primary">Inteligência</Link></div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {view.alerts.length === 0 && <div className="text-sm text-muted-foreground">Nenhum alerta de reposição ou validade.</div>}
              {view.alerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between gap-3 text-sm border-b border-border pb-2">
                  <div className="min-w-0"><div className="truncate font-medium">{alert.title}</div><div className="text-xs text-muted-foreground">{getClinic(alert.branchId).name} · {alert.detail}</div></div>
                  <Badge variant="outline" className={alert.kind === "Validade" ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-warning/10 text-warning border-warning/30"}>{alert.kind}</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4"><div className="font-semibold">Maior valor parado</div><Link to="/materiais" className="text-xs text-primary">Catálogo</Link></div>
            <div className="space-y-2">
              {view.ranking.length === 0 && <div className="text-sm text-muted-foreground">Nenhum saldo nas unidades visíveis.</div>}
              {view.ranking.map((row) => (
                <div key={row.item.id} className="flex items-center justify-between gap-3 text-sm border-b border-border pb-2">
                  <div className="min-w-0"><div className="truncate font-medium">{row.item.name}</div><div className="text-xs text-muted-foreground">{row.qty} {row.item.unit} · mín. {row.item.min}</div></div>
                  <span className="font-medium whitespace-nowrap">{brl(row.value)}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4"><div className="font-semibold">Transferências abertas</div><Link to="/transferencias" className="text-xs text-primary">Ver fluxo</Link></div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {view.pending.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma transferência em andamento.</div>}
              {view.pending.slice(0, 6).map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 text-sm border-b border-border pb-2">
                  <div className="min-w-0"><div className="font-mono text-xs">{row.number}</div><div className="truncate text-xs text-muted-foreground">{shortName(getClinic(row.fromId).name)} → {shortName(getClinic(row.toId).name)}</div></div>
                  <Badge variant="outline">{transferLabels[row.status]}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4"><div className="font-semibold">Últimas movimentações</div><Link to="/movimentacoes" className="text-xs text-primary">Ver todas</Link></div>
          <div className="divide-y divide-border">
            {view.movements.length === 0 && <div className="text-sm text-muted-foreground">Nenhum lançamento nas unidades visíveis.</div>}
            {view.movements.slice(0, 8).map((row) => (
              <div key={row.id} className="py-2 flex items-center gap-3 text-sm">
                <Badge variant="outline" className="capitalize w-28 justify-center">{row.type}</Badge>
                <div className="flex-1 min-w-0"><div className="truncate">{getMaterial(row.materialId).name}</div><div className="text-xs text-muted-foreground truncate">{row.reason}</div></div>
                <div className="text-muted-foreground hidden md:block truncate max-w-48">{shortName(getClinic(row.clinicId).name)}</div>
                <div className="text-muted-foreground hidden lg:block w-24">{row.date.slice(0, 10).split("-").reverse().join("/")}</div>
                <div className="font-medium w-16 text-right">{row.type === "saida" ? "-" : "+"}{row.qty}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
