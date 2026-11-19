import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useUserProfiles } from "@/lib/store";
import { daysUntil } from "@/lib/mock-data";
import { useWork } from "@/lib/work-live";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

export const Route = createFileRoute("/relatorios")({
  head: () => ({ meta: [
    { title: "Relatórios — Grupo Sorrisos Tasks" },
    { name: "description", content: "Relatórios de produtividade e SLA." },
    { property: "og:title", content: "Relatórios — Grupo Sorrisos Tasks" },
    { property: "og:description", content: "Relatórios de produtividade e SLA." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: ReportsPage,
});

function ReportsPage() {
  const tasks = useWork().tasks;
  const projects = useWork().projects;
  const users = useUserProfiles();
  const byProject = projects.map(p => {
    const pt = tasks.filter(t => t.projectId === p.id);
    return { name: p.name.split(" ").slice(0,2).join(" "), concluidas: pt.filter(t => t.status === "concluido").length, atrasadas: pt.filter(t => t.status !== "concluido" && daysUntil(t.dueDate) < 0).length };
  });

  const slaPct = tasks.length ? Math.round(tasks.filter(t => t.status === "concluido").length / tasks.length * 100) : 0;
  const sla = [{ name: "SLA", value: slaPct, fill: "var(--chart-1)" }];

  const byDept = Array.from(new Set(tasks.map(t => t.department))).map(d => {
    const dt = tasks.filter(t => t.department === d);
    return { name: d, total: dt.length, concluidas: dt.filter(t => t.status === "concluido").length };
  });

  const ranking = [...users].map(u => {
    const my = tasks.filter(t => t.assigneeId === u.id);
    const done = my.filter(t => t.status === "concluido").length;
    const overdue = my.filter(t => t.status !== "concluido" && daysUntil(t.dueDate) < 0).length;
    return { ...u, done, overdue, score: done * 10 - overdue * 5 };
  }).sort((a,b) => b.score - a.score);

  return (
    <AppShell title="Relatórios" subtitle="Produtividade e SLA" primaryAction={null}>
      <div className="p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-5 lg:col-span-2">
            <h3 className="font-semibold mb-1">Tarefas por projeto</h3>
            <p className="text-xs text-muted-foreground mb-4">Concluídas vs atrasadas</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byProject}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="concluidas" stackId="a" fill="var(--chart-3)" radius={[0,0,0,0]} />
                <Bar dataKey="atrasadas" stackId="a" fill="var(--destructive)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card className="p-5 flex flex-col">
            <h3 className="font-semibold mb-1">SLA geral</h3>
            <p className="text-xs text-muted-foreground mb-4">% de tarefas no prazo</p>
            <div className="flex-1 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <RadialBarChart innerRadius="70%" outerRadius="100%" data={sla} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar background dataKey="value" cornerRadius={10} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center -mt-32 mb-12 pointer-events-none">
              <div className="text-4xl font-bold">{slaPct}%</div>
              <div className="text-xs text-muted-foreground">no prazo</div>
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="font-semibold mb-1">Produtividade por departamento</h3>
          <p className="text-xs text-muted-foreground mb-4">Total vs concluídas</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byDept} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={11} width={90} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="total" fill="var(--chart-2)" radius={[0,4,4,0]} />
              <Bar dataKey="concluidas" fill="var(--chart-3)" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4">Ranking de produtividade</h3>
          <ol className="space-y-2">
            {ranking.map((u, i) => (
              <li key={u.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-warning text-warning-foreground" : i === 1 ? "bg-muted text-foreground" : i === 2 ? "bg-accent text-accent-foreground" : "bg-muted/50 text-muted-foreground"}`}>{i+1}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.department}</div>
                </div>
                <div className="flex gap-4 text-center">
                  <div><div className="text-sm font-bold text-success">{u.done}</div><div className="text-[10px] text-muted-foreground uppercase">Conclui</div></div>
                  <div><div className="text-sm font-bold text-destructive">{u.overdue}</div><div className="text-[10px] text-muted-foreground uppercase">Atraso</div></div>
                  <div><div className="text-sm font-bold text-primary">{u.score}</div><div className="text-[10px] text-muted-foreground uppercase">Score</div></div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </AppShell>
  );
}
