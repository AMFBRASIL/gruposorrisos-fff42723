import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Clock, AlertTriangle, ListTodo, TrendingUp, Activity as ActivityIcon } from "lucide-react";
import { useTasks } from "@/lib/store";
import { daysUntil, projects, users, recentActivity, getUser } from "@/lib/mock-data";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { UserAvatar } from "@/components/task-card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Dashboard — Grupo Sorrisos Tasks" },
    { name: "description", content: "Painel executivo de gestão de tarefas corporativas do Grupo Sorrisos." },
  ]}),
  component: Dashboard,
});

function Dashboard() {
  const tasks = useTasks();
  const total = tasks.length;
  const inProgress = tasks.filter(t => t.status !== "concluido" && t.status !== "backlog").length;
  const done = tasks.filter(t => t.status === "concluido").length;
  const overdue = tasks.filter(t => t.status !== "concluido" && daysUntil(t.dueDate) < 0).length;
  const soon = tasks.filter(t => t.status !== "concluido" && daysUntil(t.dueDate) >= 0 && daysUntil(t.dueDate) <= 3).length;

  const cards = [
    { label: "Total de Tarefas", value: total, icon: ListTodo, color: "text-primary", bg: "bg-primary/10" },
    { label: "Em Andamento", value: inProgress, icon: Clock, color: "text-info", bg: "bg-info/10" },
    { label: "Concluídas", value: done, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    { label: "Atrasadas", value: overdue, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Próximas do Vencimento", value: soon, icon: TrendingUp, color: "text-warning", bg: "bg-warning/10" },
  ];

  const byUser = users.map(u => ({
    name: u.name.split(" ")[0],
    concluidas: tasks.filter(t => t.assigneeId === u.id && t.status === "concluido").length,
    ativas: tasks.filter(t => t.assigneeId === u.id && t.status !== "concluido").length,
  }));

  const byDept = Array.from(new Set(tasks.map(t => t.department))).map(d => ({
    name: d,
    value: tasks.filter(t => t.department === d).length,
  }));
  const pieColors = ["var(--chart-1)","var(--chart-2)","var(--chart-3)","var(--chart-4)","var(--chart-5)","oklch(0.65 0.18 25)","oklch(0.7 0.18 340)"];

  const trend = Array.from({ length: 14 }, (_, i) => ({
    dia: `${i+1}`,
    concluidas: Math.round(3 + Math.sin(i/2) * 2 + Math.random() * 2),
  }));

  return (
    <AppShell title="Dashboard Executivo" subtitle="Visão geral das demandas do Grupo Sorrisos">
      <div className="p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {cards.map(c => {
            const Icon = c.icon;
            return (
              <Card key={c.label} className="p-4 border-border/60">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">{c.label}</div>
                    <div className="text-3xl font-bold mt-1">{c.value}</div>
                  </div>
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${c.bg}`}>
                    <Icon className={`h-4 w-4 ${c.color}`} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Produtividade por usuário</h3>
                <p className="text-xs text-muted-foreground">Tarefas concluídas vs ativas</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byUser}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="concluidas" fill="var(--chart-3)" radius={[4,4,0,0]} />
                <Bar dataKey="ativas" fill="var(--chart-1)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-1">Distribuição por departamento</h3>
            <p className="text-xs text-muted-foreground mb-4">Carga de trabalho atual</p>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byDept} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {byDept.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-5 lg:col-span-2">
            <h3 className="font-semibold mb-1">Tarefas concluídas por período</h3>
            <p className="text-xs text-muted-foreground mb-4">Últimos 14 dias</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="concluidas" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><ActivityIcon className="h-4 w-4 text-primary" /> Atividade recente</h3>
            <ul className="space-y-3">
              {recentActivity.map(a => {
                const u = users.find(x => x.name === a.user);
                return (
                  <li key={a.id} className="flex gap-3 text-sm">
                    {u && <UserAvatar id={u.id} size={28} />}
                    <div className="flex-1 min-w-0">
                      <p className="leading-snug"><span className="font-medium">{a.user}</span> <span className="text-muted-foreground">{a.action}</span> <span className="font-medium">{a.target}</span></p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{a.at}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="font-semibold mb-4">Saúde dos projetos</h3>
          <div className="space-y-4">
            {projects.map(p => {
              const owner = getUser(p.ownerId);
              const hColor = p.health >= 75 ? "bg-success" : p.health >= 50 ? "bg-warning" : "bg-destructive";
              return (
                <div key={p.id} className="flex items-center gap-4">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{p.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{owner?.name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <Progress value={p.progress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground w-10 text-right">{p.progress}%</span>
                      <div className="flex items-center gap-1 w-20">
                        <span className={`h-1.5 w-1.5 rounded-full ${hColor}`} />
                        <span className="text-xs">Saúde {p.health}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
