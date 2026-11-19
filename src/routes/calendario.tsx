import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useTasks } from "@/lib/store";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { getProject, priorityMeta, type Task } from "@/lib/mock-data";
import { TaskDialog } from "@/components/task-dialog";
import { CreateTaskWizard } from "@/components/create-task-wizard";

export const Route = createFileRoute("/calendario")({
  head: () => ({ meta: [
    { title: "Calendário — Grupo Sorrisos Tasks" },
    { name: "description", content: "Calendário mensal das tarefas e prazos." },
    { property: "og:title", content: "Calendário — Grupo Sorrisos Tasks" },
    { property: "og:description", content: "Calendário mensal das tarefas e prazos." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: CalendarPage,
});

function CalendarPage() {
  const tasks = useTasks();
  const [cursor, setCursor] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [open, setOpen] = useState<Task | null>(null);
  const [createFor, setCreateFor] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const cells: { date: Date | null; iso: string; tasks: Task[] }[] = [];
  for (let i = 0; i < startOffset; i++) cells.push({ date: null, iso: "", tasks: [] });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const iso = toIso(date);
    cells.push({ date, iso, tasks: tasks.filter(t => t.dueDate === iso) });
  }

  return (
    <AppShell title="Calendário" subtitle="Prazos das tarefas">
      <div className="p-4 md:p-8">
        <Card className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold capitalize">{monthName}</h2>
            <div className="flex gap-1">
              <Button size="icon" variant="outline" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => { const now = new Date(); setCursor(new Date(now.getFullYear(), now.getMonth(), 1)); }}>Hoje</Button>
              <Button size="icon" variant="outline" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs font-semibold text-muted-foreground uppercase mb-1">
            {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d => <div key={d} className="px-2 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              const isToday = c.iso === toIso(new Date());
              return (
                <div
                  key={i}
                  onClick={() => c.date && setCreateFor(c.iso)}
                  className={`group relative min-h-24 rounded-lg border p-1.5 transition-colors ${
                    c.date ? "bg-card cursor-pointer hover:border-primary/60 hover:bg-accent/30" : "bg-transparent border-transparent"
                  } ${isToday ? "border-primary ring-1 ring-primary" : "border-border"}`}
                >
                  {c.date && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <div className={`text-xs font-semibold ${isToday ? "text-primary" : ""}`}>{c.date.getDate()}</div>
                        <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="space-y-1">
                        {c.tasks.slice(0, 3).map(t => {
                          const p = getProject(t.projectId);
                          return (
                            <button
                              key={t.id}
                              onClick={(e) => { e.stopPropagation(); setOpen(t); }}
                              className="w-full text-left text-[10px] rounded px-1.5 py-0.5 truncate hover:opacity-80"
                              style={{ backgroundColor: `${p?.color}20`, color: p?.color, borderLeft: `2px solid ${p?.color}` }}
                            >
                              {t.title}
                            </button>
                          );
                        })}
                        {c.tasks.length > 3 && <div className="text-[10px] text-muted-foreground px-1.5">+{c.tasks.length - 3} mais</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="mt-4 p-5">
          <h3 className="font-semibold mb-3">Próximos prazos</h3>
          <ul className="divide-y divide-border">
            {tasks.filter(t => t.status !== "concluido").sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0,8).map(t => {
              const p = getProject(t.projectId);
              return (
                <li key={t.id} className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-muted/40 px-2 rounded" onClick={() => setOpen(t)}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p?.color }} />
                  <span className="flex-1 text-sm truncate">{t.title}</span>
                  <span className={`text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 ${priorityMeta[t.priority].className}`}>{priorityMeta[t.priority].label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{t.dueDate}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      <TaskDialog task={open} onClose={() => setOpen(null)} />
      <CreateTaskWizard open={createFor !== null} dueDate={createFor} onClose={() => setCreateFor(null)} />
    </AppShell>
  );
}
