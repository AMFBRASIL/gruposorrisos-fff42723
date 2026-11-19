import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useTasks } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { TaskCard } from "@/components/task-card";
import { TaskDialog } from "@/components/task-dialog";
import { useMemo, useState } from "react";
import { type Task, daysUntil } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/minhas-tarefas")({
  head: () => ({ meta: [
    { title: "Minhas Tarefas — Grupo Sorrisos Tasks" },
    { name: "description", content: "Lista de tarefas atribuídas a você." },
    { property: "og:title", content: "Minhas Tarefas — Grupo Sorrisos Tasks" },
    { property: "og:description", content: "Lista de tarefas atribuídas a você." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: MyTasksPage,
});

function MyTasksPage() {
  const tasks = useTasks();
  const auth = useAuth();
  const [open, setOpen] = useState<Task | null>(null);
  const me = auth.user?.id ?? "";
  const mine = useMemo(() => tasks.filter(t => t.assigneeId === me || t.participantIds.includes(me)), [tasks, me]);

  const groups = useMemo(() => {
    const overdue = mine.filter(t => t.status !== "concluido" && daysUntil(t.dueDate) < 0);
    const today = mine.filter(t => t.status !== "concluido" && daysUntil(t.dueDate) === 0);
    const soon = mine.filter(t => t.status !== "concluido" && daysUntil(t.dueDate) > 0 && daysUntil(t.dueDate) <= 7);
    const later = mine.filter(t => t.status !== "concluido" && daysUntil(t.dueDate) > 7);
    const done = mine.filter(t => t.status === "concluido");
    return [
      { id: "overdue", label: "Atrasadas", color: "text-destructive", items: overdue },
      { id: "today", label: "Hoje", color: "text-warning", items: today },
      { id: "soon", label: "Próximos 7 dias", color: "text-info", items: soon },
      { id: "later", label: "Mais tarde", color: "text-muted-foreground", items: later },
      { id: "done", label: "Concluídas", color: "text-success", items: done },
    ];
  }, [mine]);

  return (
    <AppShell title="Minhas Tarefas" subtitle={`${mine.length} tarefas atribuídas a você`}>
      <div className="p-4 md:p-8 space-y-6">
        {groups.map(g => g.items.length > 0 && (
          <section key={g.id}>
            <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${g.color}`}>
              {g.label} <span className="text-xs bg-muted rounded px-1.5 py-0.5 text-muted-foreground">{g.items.length}</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {g.items.map(t => <TaskCard key={t.id} task={t} onClick={() => setOpen(t)} />)}
            </div>
          </section>
        ))}
        {mine.length === 0 && <Card className="p-12 text-center text-muted-foreground">Nenhuma tarefa atribuída.</Card>}
      </div>
      <TaskDialog task={open} onClose={() => setOpen(null)} />
    </AppShell>
  );
}
