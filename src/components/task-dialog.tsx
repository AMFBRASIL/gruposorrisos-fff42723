import { Dialog, DialogContent } from "@/components/ui/dialog";
import { type Task, getUser, getProject, priorityMeta, COLUMNS } from "@/lib/mock-data";
import { tasksStore } from "@/lib/store";
import { UserAvatar, PriorityBadge } from "@/components/task-card";
import {
  Calendar, Clock, MessageSquare, Paperclip, CheckSquare2, Tag,
  Activity as ActivityIcon, Plus, ArrowRight, CheckCircle2, FileText,
  MessageCircle, PlayCircle, Flag, Send, MoreHorizontal, Link2,
  Sparkles, X,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemo, useState } from "react";

type TLKind = "created" | "status" | "comment" | "checklist" | "attachment" | "assigned" | "due" | "log" | "completed";
interface TLEvent {
  id: string; kind: TLKind; at: string; user: string;
  title: string; detail?: string;
}

const kindMeta: Record<TLKind, { icon: any; ring: string; bg: string; fg: string }> = {
  created:    { icon: Sparkles,     ring: "ring-primary/30",     bg: "bg-primary/15",     fg: "text-primary" },
  status:     { icon: ArrowRight,   ring: "ring-info/30",        bg: "bg-info/15",        fg: "text-info" },
  comment:    { icon: MessageCircle,ring: "ring-violet-500/30",  bg: "bg-violet-500/15",  fg: "text-violet-500" },
  checklist:  { icon: CheckCircle2, ring: "ring-success/30",     bg: "bg-success/15",     fg: "text-success" },
  attachment: { icon: Paperclip,    ring: "ring-muted",          bg: "bg-muted",          fg: "text-foreground" },
  assigned:   { icon: Flag,         ring: "ring-warning/30",     bg: "bg-warning/15",     fg: "text-warning" },
  due:        { icon: Calendar,     ring: "ring-warning/30",     bg: "bg-warning/15",     fg: "text-warning" },
  log:        { icon: Clock,        ring: "ring-info/30",        bg: "bg-info/15",        fg: "text-info" },
  completed:  { icon: CheckCircle2, ring: "ring-success/40",     bg: "bg-success/20",     fg: "text-success" },
};

function buildTimeline(task: Task): TLEvent[] {
  const assignee = getUser(task.assigneeId);
  const events: TLEvent[] = [];
  events.push({ id: "ev-c", kind: "created", at: task.createdAt, user: "Sistema", title: "Tarefa criada", detail: `Adicionada ao projeto` });
  if (assignee) events.push({ id: "ev-a", kind: "assigned", at: task.createdAt, user: assignee.name, title: `Atribuída a ${assignee.name}`, detail: assignee.role });
  events.push({ id: "ev-s1", kind: "status", at: task.startDate, user: assignee?.name || "—", title: "Movida para A Fazer", detail: "Backlog → A Fazer" });
  if (task.loggedHours > 0) {
    events.push({ id: "ev-s2", kind: "status", at: task.startDate, user: assignee?.name || "—", title: "Trabalho iniciado", detail: "A Fazer → Em Desenvolvimento" });
    events.push({ id: "ev-log", kind: "log", at: task.startDate, user: assignee?.name || "—", title: `${task.loggedHours}h registradas`, detail: `Estimado: ${task.estimatedHours}h` });
  }
  task.checklist.filter(c => c.done).forEach((c, i) =>
    events.push({ id: `ev-cl-${c.id}`, kind: "checklist", at: task.startDate, user: assignee?.name || "—", title: `Concluído: ${c.text}` })
  );
  task.comments.forEach(c => {
    const u = getUser(c.userId);
    events.push({ id: `ev-cm-${c.id}`, kind: "comment", at: c.at, user: u?.name || "—", title: "Novo comentário", detail: c.text });
  });
  task.attachments.forEach(a =>
    events.push({ id: `ev-at-${a.id}`, kind: "attachment", at: task.startDate, user: assignee?.name || "—", title: `Anexo: ${a.name}`, detail: a.size })
  );
  if (task.status !== "backlog" && task.status !== "todo") {
    const col = COLUMNS.find(c => c.id === task.status);
    events.push({ id: "ev-cur", kind: "status", at: task.startDate, user: assignee?.name || "—", title: `Status atual: ${col?.title}` });
  }
  if (task.completedAt) {
    events.push({ id: "ev-done", kind: "completed", at: task.completedAt, user: assignee?.name || "—", title: "Tarefa concluída", detail: "Movida para Concluído" });
  }
  return events.sort((a, b) => a.at.localeCompare(b.at)).reverse();
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
}

export function TaskDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const [tab, setTab] = useState("detalhes");
  const [newComment, setNewComment] = useState("");

  const timeline = useMemo(() => task ? buildTimeline(task) : [], [task]);

  if (!task) return null;
  const project = getProject(task.projectId);
  const assignee = getUser(task.assigneeId);
  const done = task.checklist.filter(c => c.done).length;
  const pct = task.checklist.length ? Math.round((done / task.checklist.length) * 100) : 0;
  const col = COLUMNS.find(c => c.id === task.status);

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="relative border-b border-border">
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: `linear-gradient(90deg, ${project?.color}, transparent)` }}
          />
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project?.color }} />
              <span className="font-medium text-foreground/80">{project?.name}</span>
              <span>/</span>
              <span>{task.department}</span>
              <span>/</span>
              <span className="font-mono">#{task.id.toUpperCase()}</span>
              <div className="ml-auto flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7"><Link2 className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight leading-tight mb-3">{task.title}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {col?.title}
              </span>
              <PriorityBadge p={task.priority} />
              {assignee && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-muted">
                  <UserAvatar id={assignee.id} size={18} />
                  <span>{assignee.name}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted">
                <Calendar className="h-3 w-3" /> {fmtDate(task.dueDate)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted">
                <Clock className="h-3 w-3" /> {task.loggedHours}h / {task.estimatedHours}h
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] overflow-hidden" style={{ maxHeight: "calc(92vh - 160px)" }}>
          {/* Main */}
          <div className="overflow-y-auto">
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <div className="px-6 pt-4 border-b border-border sticky top-0 bg-background z-10">
                <TabsList className="bg-transparent p-0 h-auto gap-1">
                  <TabsTrigger value="detalhes" className="data-[state=active]:bg-muted rounded-md text-xs"><FileText className="h-3.5 w-3.5 mr-1.5" />Detalhes</TabsTrigger>
                  <TabsTrigger value="timeline" className="data-[state=active]:bg-muted rounded-md text-xs"><ActivityIcon className="h-3.5 w-3.5 mr-1.5" />Timeline <span className="ml-1.5 text-[10px] bg-muted px-1.5 rounded-full">{timeline.length}</span></TabsTrigger>
                  <TabsTrigger value="comentarios" className="data-[state=active]:bg-muted rounded-md text-xs"><MessageSquare className="h-3.5 w-3.5 mr-1.5" />Comentários <span className="ml-1.5 text-[10px] bg-muted px-1.5 rounded-full">{task.comments.length}</span></TabsTrigger>
                  <TabsTrigger value="anexos" className="data-[state=active]:bg-muted rounded-md text-xs"><Paperclip className="h-3.5 w-3.5 mr-1.5" />Anexos <span className="ml-1.5 text-[10px] bg-muted px-1.5 rounded-full">{task.attachments.length}</span></TabsTrigger>
                </TabsList>
              </div>

              {/* DETALHES */}
              <TabsContent value="detalhes" className="px-6 py-5 space-y-6 mt-0">
                <section>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Descrição</h4>
                  <p className="text-sm leading-relaxed text-foreground/90">{task.description || "Sem descrição."}</p>
                </section>

                {task.tags.length > 0 && (
                  <section>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Tag className="h-3 w-3" /> Tags</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {task.tags.map(t => <span key={t} className="text-xs rounded-md bg-muted px-2 py-1 font-medium">#{t}</span>)}
                    </div>
                  </section>
                )}

                {task.checklist.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><CheckSquare2 className="h-3 w-3" /> Checklist</h4>
                      <span className="text-xs font-medium text-muted-foreground">{done}/{task.checklist.length} · {pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5 mb-3" />
                    <ul className="space-y-1.5">
                      {task.checklist.map(c => (
                        <li key={c.id} className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors group">
                          <Checkbox checked={c.done} onCheckedChange={(v) => {
                            tasksStore.updateTask(task.id, { checklist: task.checklist.map(x => x.id === c.id ? { ...x, done: !!v } : x) });
                          }} />
                          <span className={`text-sm flex-1 ${c.done ? "line-through text-muted-foreground" : ""}`}>{c.text}</span>
                        </li>
                      ))}
                    </ul>
                    <Button size="sm" variant="ghost" className="mt-1 text-xs text-muted-foreground"><Plus className="h-3 w-3" /> Adicionar item</Button>
                  </section>
                )}

                <section>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Clock className="h-3 w-3" /> Horas trabalhadas</h4>
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="text-2xl font-semibold">{task.loggedHours}<span className="text-sm font-normal text-muted-foreground">h</span></div>
                      <div className="text-xs text-muted-foreground">de {task.estimatedHours}h estimadas</div>
                    </div>
                    <Progress value={task.estimatedHours ? Math.min(100, (task.loggedHours/task.estimatedHours)*100) : 0} className="h-1.5" />
                  </div>
                </section>
              </TabsContent>

              {/* TIMELINE */}
              <TabsContent value="timeline" className="px-6 py-5 mt-0">
                <div className="relative">
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
                  <ul className="space-y-4">
                    {timeline.map((e) => {
                      const m = kindMeta[e.kind];
                      const Icon = m.icon;
                      return (
                        <li key={e.id} className="relative pl-10">
                          <span className={`absolute left-0 top-0.5 h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-background ${m.bg}`}>
                            <Icon className={`h-3.5 w-3.5 ${m.fg}`} />
                          </span>
                          <div className="rounded-lg border border-border bg-card/50 p-3 hover:bg-card transition-colors">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium">{e.title}</div>
                                {e.detail && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{e.detail}</div>}
                              </div>
                              <div className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">{fmtDate(e.at)}</div>
                            </div>
                            <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                              por <span className="font-medium text-foreground/80">{e.user}</span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </TabsContent>

              {/* COMENTÁRIOS */}
              <TabsContent value="comentarios" className="px-6 py-5 mt-0">
                <ul className="space-y-3 mb-4">
                  {task.comments.map(c => {
                    const u = getUser(c.userId);
                    return (
                      <li key={c.id} className="flex gap-3">
                        <UserAvatar id={c.userId} size={32} />
                        <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold">{u?.name}</span>
                            <span className="text-muted-foreground">{fmtDate(c.at)}</span>
                          </div>
                          <p className="text-sm mt-1 leading-relaxed">{c.text}</p>
                        </div>
                      </li>
                    );
                  })}
                  {task.comments.length === 0 && (
                    <li className="text-center py-8 text-sm text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Nenhum comentário ainda. Seja o primeiro!
                    </li>
                  )}
                </ul>
                <div className="rounded-lg border border-border focus-within:border-primary/50 transition-colors">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Escreva um comentário... use @ para mencionar"
                    className="min-h-20 border-0 focus-visible:ring-0 resize-none"
                  />
                  <div className="flex items-center justify-between p-2 border-t border-border">
                    <div className="text-[11px] text-muted-foreground px-2">Markdown suportado</div>
                    <Button size="sm" disabled={!newComment.trim()}><Send className="h-3 w-3" /> Comentar</Button>
                  </div>
                </div>
              </TabsContent>

              {/* ANEXOS */}
              <TabsContent value="anexos" className="px-6 py-5 mt-0">
                {task.attachments.length > 0 ? (
                  <ul className="space-y-2">
                    {task.attachments.map(a => (
                      <li key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50">
                        <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center"><FileText className="h-4 w-4" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{a.name}</div>
                          <div className="text-xs text-muted-foreground">{a.size} · {a.type}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-12 text-sm text-muted-foreground border-2 border-dashed border-border rounded-lg">
                    <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Arraste arquivos aqui ou <span className="text-primary cursor-pointer">clique para anexar</span>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <aside className="border-l border-border bg-muted/20 p-5 space-y-5 overflow-y-auto">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Status</label>
              <Select value={task.status} onValueChange={(v) => tasksStore.moveTask(task.id, v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Prioridade</label>
              <Select value={task.priority} onValueChange={(v: any) => tasksStore.updateTask(task.id, { priority: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(priorityMeta).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Responsável</label>
              <div className="flex items-center gap-2 rounded-md border border-border p-2 bg-background">
                {assignee && <UserAvatar id={assignee.id} size={28} />}
                <div className="text-sm min-w-0">
                  <div className="font-medium truncate">{assignee?.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{assignee?.role}</div>
                </div>
              </div>
            </div>

            {task.participantIds.length > 0 && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Participantes</label>
                <div className="flex -space-x-2">
                  {task.participantIds.map(id => <div key={id} className="ring-2 ring-background rounded-full"><UserAvatar id={id} size={28} /></div>)}
                  <button className="h-7 w-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary"><Plus className="h-3 w-3" /></button>
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Datas</label>
              <div className="rounded-md border border-border bg-background divide-y divide-border">
                <div className="flex justify-between items-center px-2.5 py-2 text-xs"><span className="text-muted-foreground">Criada</span><span>{fmtDate(task.createdAt)}</span></div>
                <div className="flex justify-between items-center px-2.5 py-2 text-xs"><span className="text-muted-foreground">Início</span><span>{fmtDate(task.startDate)}</span></div>
                <div className="flex justify-between items-center px-2.5 py-2 text-xs"><span className="text-muted-foreground">Prazo</span><span className="font-semibold">{fmtDate(task.dueDate)}</span></div>
                {task.completedAt && <div className="flex justify-between items-center px-2.5 py-2 text-xs"><span className="text-muted-foreground">Concluída</span><span className="text-success font-medium">{fmtDate(task.completedAt)}</span></div>}
              </div>
            </div>

            <Button variant="outline" className="w-full" size="sm"><PlayCircle className="h-3.5 w-3.5" /> Registrar tempo</Button>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
