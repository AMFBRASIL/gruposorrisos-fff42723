import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useTasks, tasksStore } from "@/lib/store";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import { getProject, projects, users, COLUMNS, priorityMeta, type Task, type Priority } from "@/lib/mock-data";
import { TaskDialog } from "@/components/task-dialog";

export const Route = createFileRoute("/calendario")({
  head: () => ({ meta: [
    { title: "Calendário — Grupo Sorrisos Tasks" },
    { name: "description", content: "Calendário mensal das tarefas e prazos." },
  ]}),
  component: CalendarPage,
});

function CalendarPage() {
  const tasks = useTasks();
  const [cursor, setCursor] = useState(new Date(2026, 5, 1));
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
              <Button size="sm" variant="outline" onClick={() => setCursor(new Date(2026, 5, 1))}>Hoje</Button>
              <Button size="icon" variant="outline" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs font-semibold text-muted-foreground uppercase mb-1">
            {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d => <div key={d} className="px-2 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              const isToday = c.iso === "2026-06-10";
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
      <CreateTaskDialog iso={createFor} onClose={() => setCreateFor(null)} />
    </AppShell>
  );
}

function CreateTaskDialog({ iso, onClose }: { iso: string | null; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(projects[0].id);
  const [assigneeId, setAssigneeId] = useState(users[0].id);
  const [priority, setPriority] = useState<Priority>("normal");
  const [status, setStatus] = useState(COLUMNS[1].id);
  const [estimatedHours, setEstimatedHours] = useState("4");

  const open = iso !== null;
  const prettyDate = iso
    ? new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    : "";

  const reset = () => {
    setTitle(""); setDescription(""); setProjectId(projects[0].id);
    setAssigneeId(users[0].id); setPriority("normal"); setStatus(COLUMNS[1].id); setEstimatedHours("4");
  };

  const submit = () => {
    if (!title.trim() || !iso) return;
    const id = `t_${Date.now().toString(36)}`;
    tasksStore.addTask({
      id,
      title: title.trim(),
      description: description.trim(),
      projectId,
      assigneeId,
      participantIds: [assigneeId],
      department: users.find(u => u.id === assigneeId)?.department ?? "",
      tags: [],
      priority,
      status,
      createdAt: "2026-06-10",
      startDate: "2026-06-10",
      dueDate: iso,
      checklist: [],
      comments: [],
      attachments: [],
      estimatedHours: Number(estimatedHours) || 0,
      loggedHours: 0,
    });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <CalendarDays className="h-4 w-4" />
            </span>
            <div>
              <div className="text-base">Nova tarefa</div>
              <div className="text-xs font-normal text-muted-foreground capitalize">{prettyDate}</div>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Revisar contrato com fornecedor" className="mt-1.5" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes da tarefa..." className="mt-1.5 min-h-20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Projeto</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Coluna do Kanban</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["baixa","normal","alta","urgente","critica"] as Priority[]).map(p => (
                    <SelectItem key={p} value={p}>{priorityMeta[p].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Horas estimadas</Label>
              <Input type="number" min="0" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} className="mt-1.5 w-32" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={submit} disabled={!title.trim()}>Criar tarefa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
