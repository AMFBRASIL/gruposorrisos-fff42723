import { priorityMeta, type Priority, type Task, getUser, getProject, daysUntil } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, MessageSquare, Paperclip, CheckSquare, Clock, Play, Pause, Lock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useActiveTimer, timerStore, useTasks } from "@/lib/store";

export function PriorityBadge({ p }: { p: Priority }) {
  const m = priorityMeta[p];
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${m.className}`}>{m.label}</span>;
}

export function UserAvatar({ id, size = 24 }: { id: string; size?: number }) {
  const u = getUser(id);
  if (!u) return null;
  return (
    <Avatar style={{ width: size, height: size }}>
      <AvatarFallback style={{ backgroundColor: u.color, color: "white", fontSize: size * 0.4 }}>{u.initials}</AvatarFallback>
    </Avatar>
  );
}

export function TaskCard({ task, onClick }: { task: Task; onClick?: () => void }) {
  const project = getProject(task.projectId);
  const dleft = daysUntil(task.dueDate);
  const overdue = dleft < 0 && task.status !== "concluido";
  const soon = dleft >= 0 && dleft <= 3 && task.status !== "concluido";
  const checkDone = task.checklist.filter(c => c.done).length;
  const pct = task.checklist.length ? Math.round((checkDone / task.checklist.length) * 100) : 0;
  const auth = useAuth();
  const active = useActiveTimer();
  const allTasks = useTasks();
  const running = active?.taskId === task.id;
  const blockers = (task.dependsOn || [])
    .map(id => allTasks.find(t => t.id === id))
    .filter(t => t && t.status !== "concluido");
  const blocked = blockers.length > 0;

  const toggleTimer = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (running) timerStore.stop();
    else if (auth.user) timerStore.start(task.id, auth.user.id);
  };

  return (
    <div onClick={onClick} className="group cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project?.color }} />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium truncate">{project?.name}</span>
        <div className="ml-auto flex items-center gap-1">
          {blocked && (
            <span title={`Bloqueada por ${blockers.length} tarefa(s)`} className="inline-flex items-center gap-0.5 rounded-md bg-warning/15 text-warning px-1.5 py-0.5 text-[9px] font-semibold">
              <Lock className="h-2.5 w-2.5" />{blockers.length}
            </span>
          )}
          <PriorityBadge p={task.priority} />
        </div>
      </div>
      <h4 className="text-sm font-medium leading-snug mb-2 group-hover:text-primary transition-colors">{task.title}</h4>
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.map(t => <span key={t} className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">#{t}</span>)}
        </div>
      )}
      {task.checklist.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" /> {checkDone}/{task.checklist.length}</span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-1" />
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${overdue ? "bg-destructive/15 text-destructive font-medium" : soon ? "bg-warning/15 text-warning font-medium" : ""}`}>
            <Calendar className="h-3 w-3" />
            {overdue ? `${Math.abs(dleft)}d atraso` : dleft === 0 ? "Hoje" : dleft > 0 ? `${dleft}d` : ""}
          </span>
          {task.comments.length > 0 && <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{task.comments.length}</span>}
          {task.attachments.length > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{task.attachments.length}</span>}
          {task.loggedHours > 0 && <span className="inline-flex items-center gap-0.5"><Clock className="h-3 w-3" />{task.loggedHours}h</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleTimer}
            title={running ? "Parar cronômetro" : "Iniciar cronômetro"}
            className={`h-6 w-6 rounded-md flex items-center justify-center transition-all ${
              running
                ? "bg-success text-success-foreground hover:bg-success/90"
                : "bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground"
            }`}
          >
            {running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </button>
          <div className="flex -space-x-1.5">
            <UserAvatar id={task.assigneeId} size={22} />
            {task.participantIds.slice(0, 2).map(id => <UserAvatar key={id} id={id} size={22} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
