import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Task, getUser, getProject, priorityMeta, COLUMNS } from "@/lib/mock-data";
import { tasksStore } from "@/lib/store";
import { UserAvatar, PriorityBadge } from "@/components/task-card";
import { Calendar, Clock, MessageSquare, Paperclip, CheckSquare2, Tag } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TaskDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  if (!task) return null;
  const project = getProject(task.projectId);
  const assignee = getUser(task.assigneeId);
  const done = task.checklist.filter(c => c.done).length;
  const pct = task.checklist.length ? Math.round((done / task.checklist.length) * 100) : 0;

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project?.color }} />
            <span>{project?.name}</span>
            <span>•</span>
            <span>{task.department}</span>
          </div>
          <DialogTitle className="text-xl">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
          <div className="md:col-span-2 space-y-6">
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Descrição</h4>
              <p className="text-sm leading-relaxed">{task.description || "Sem descrição."}</p>
            </div>

            {task.tags.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1"><Tag className="h-3 w-3" /> Tags</h4>
                <div className="flex flex-wrap gap-1.5">{task.tags.map(t => <span key={t} className="text-xs rounded bg-muted px-2 py-1">#{t}</span>)}</div>
              </div>
            )}

            {task.checklist.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1"><CheckSquare2 className="h-3 w-3" /> Checklist</h4>
                  <span className="text-xs text-muted-foreground">{pct}%</span>
                </div>
                <Progress value={pct} className="h-1.5 mb-3" />
                <ul className="space-y-2">
                  {task.checklist.map(c => (
                    <li key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={c.done} onCheckedChange={(v) => {
                        tasksStore.updateTask(task.id, { checklist: task.checklist.map(x => x.id === c.id ? { ...x, done: !!v } : x) });
                      }} />
                      <span className={c.done ? "line-through text-muted-foreground" : ""}>{c.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Comentários ({task.comments.length})</h4>
              <ul className="space-y-3 mb-3">
                {task.comments.map(c => {
                  const u = getUser(c.userId);
                  return (
                    <li key={c.id} className="flex gap-2">
                      <UserAvatar id={c.userId} size={28} />
                      <div className="flex-1 rounded-lg bg-muted px-3 py-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{u?.name}</span>
                          <span className="text-muted-foreground">{c.at}</span>
                        </div>
                        <p className="text-sm mt-0.5">{c.text}</p>
                      </div>
                    </li>
                  );
                })}
                {task.comments.length === 0 && <p className="text-xs text-muted-foreground">Sem comentários ainda.</p>}
              </ul>
              <Textarea placeholder="Escreva um comentário... use @ para mencionar" className="min-h-16" />
              <div className="flex justify-end mt-2"><Button size="sm">Comentar</Button></div>
            </div>
          </div>

          <aside className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Status</h4>
              <Select value={task.status} onValueChange={(v) => tasksStore.moveTask(task.id, v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Prioridade</h4>
              <Select value={task.priority} onValueChange={(v: any) => tasksStore.updateTask(task.id, { priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(priorityMeta).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Responsável</h4>
              <div className="flex items-center gap-2 rounded-lg border border-border p-2">
                {assignee && <UserAvatar id={assignee.id} size={32} />}
                <div className="text-sm">
                  <div className="font-medium">{assignee?.name}</div>
                  <div className="text-xs text-muted-foreground">{assignee?.role}</div>
                </div>
              </div>
            </div>
            {task.participantIds.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Participantes</h4>
                <div className="flex -space-x-2">{task.participantIds.map(id => <UserAvatar key={id} id={id} size={32} />)}</div>
              </div>
            )}
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1"><Calendar className="h-3 w-3" /> Datas</h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Início</span><span>{task.startDate}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Prazo</span><span className="font-medium">{task.dueDate}</span></div>
                {task.completedAt && <div className="flex justify-between"><span className="text-muted-foreground">Concluída</span><span className="text-success">{task.completedAt}</span></div>}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1"><Clock className="h-3 w-3" /> Tempo</h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Estimado</span><span>{task.estimatedHours}h</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Realizado</span><span className="font-medium">{task.loggedHours}h</span></div>
                <Progress value={task.estimatedHours ? Math.min(100, (task.loggedHours/task.estimatedHours)*100) : 0} className="h-1 mt-1" />
              </div>
            </div>
            <div className="flex items-center justify-between"><span className="text-xs uppercase font-semibold text-muted-foreground">Prioridade atual</span><PriorityBadge p={task.priority} /></div>
            {task.attachments.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1"><Paperclip className="h-3 w-3" /> Anexos</h4>
                <ul className="space-y-1 text-sm">{task.attachments.map(a => <li key={a.id} className="truncate">{a.name}</li>)}</ul>
              </div>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
