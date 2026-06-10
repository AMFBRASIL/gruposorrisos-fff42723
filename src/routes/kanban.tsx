import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { COLUMNS, projects, type Task } from "@/lib/mock-data";
import { useTasks, tasksStore } from "@/lib/store";
import { TaskCard } from "@/components/task-card";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { Plus, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskDialog } from "@/components/task-dialog";
import { CreateTaskWizard } from "@/components/create-task-wizard";

export const Route = createFileRoute("/kanban")({
  head: () => ({ meta: [
    { title: "Kanban — Grupo Sorrisos Tasks" },
    { name: "description", content: "Quadro Kanban interativo com drag-and-drop." },
  ]}),
  component: KanbanPage,
});

function DraggableCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.3 : 1 }}>
      <TaskCard task={task} onClick={onOpen} />
    </div>
  );
}


function Column({ id, title, tasks, onOpen, onCreate }: { id: string; title: string; tasks: Task[]; onOpen: (t: Task) => void; onCreate: (colId: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`flex flex-col w-72 shrink-0 rounded-xl border bg-muted/30 transition-colors ${isOver ? "border-primary bg-primary/5" : "border-border"}`}>
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground bg-background rounded px-1.5 py-0.5">{tasks.length}</span>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onCreate(id)}><Plus className="h-3.5 w-3.5" /></Button>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-32">
        {tasks.map(t => <DraggableCard key={t.id} task={t} onOpen={() => onOpen(t)} />)}
        {tasks.length === 0 && (
          <button onClick={() => onCreate(id)} className="w-full text-xs text-muted-foreground text-center py-8 hover:text-primary transition-colors">
            + Nova tarefa
          </button>
        )}
      </div>
    </div>
  );
}

function KanbanPage() {
  const tasks = useTasks();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [createCol, setCreateCol] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const filtered = useMemo(() => projectFilter === "all" ? tasks : tasks.filter(t => t.projectId === projectFilter), [tasks, projectFilter]);
  const byCol = useMemo(() => {
    const map: Record<string, Task[]> = {};
    COLUMNS.forEach(c => map[c.id] = []);
    filtered.forEach(t => { if (map[t.status]) map[t.status].push(t); });
    return map;
  }, [filtered]);

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const overId = String(e.over.id);
    const taskId = String(e.active.id);
    if (COLUMNS.some(c => c.id === overId)) {
      tasksStore.moveTask(taskId, overId);
    }
  }

  return (
    <AppShell title="Kanban" subtitle="Arraste tarefas entre colunas" actions={
    <AppShell title="Kanban" subtitle="Arraste tarefas entre colunas" actions={
      <div className="hidden md:flex items-center gap-2">
        <Button size="sm" onClick={() => setCreateCol(COLUMNS[1].id)}><Plus className="h-3.5 w-3.5" /> Nova tarefa</Button>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-56 h-9"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    }>
      <div className="p-4 md:p-6 overflow-x-auto">
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-4 min-w-max pb-4">
            {COLUMNS.map(c => <Column key={c.id} id={c.id} title={c.title} tasks={byCol[c.id]} onOpen={setOpenTask} />)}
            <button className="w-72 shrink-0 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors h-12 flex items-center justify-center gap-2"><Plus className="h-4 w-4" /> Adicionar coluna</button>
          </div>
          <DragOverlay>{activeTask ? <div className="rotate-2"><TaskCard task={activeTask} /></div> : null}</DragOverlay>
        </DndContext>
      </div>
      <TaskDialog task={openTask} onClose={() => setOpenTask(null)} />
    </AppShell>
  );
}
