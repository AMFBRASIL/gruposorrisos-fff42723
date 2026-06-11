import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { type Task, type ChecklistItem, getUser, getProject, priorityMeta, COLUMNS, users } from "@/lib/mock-data";
import { tasksStore } from "@/lib/store";
import { UserAvatar, PriorityBadge } from "@/components/task-card";
import {
  Calendar, Clock, MessageSquare, Paperclip, CheckSquare2, Tag,
  Activity as ActivityIcon, Plus, ArrowRight, CheckCircle2, FileText,
  MessageCircle, PlayCircle, Flag, Send, MoreHorizontal, Link2,
  Sparkles, X, Pencil, Save, Trash2, Star, Eye, Share2, GitBranch,
  AlarmClock, Users as UsersIcon, ChevronDown, Hash, Building2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEffect, useMemo, useState } from "react";

type TLKind = "created" | "status" | "comment" | "checklist" | "attachment" | "assigned" | "due" | "log" | "completed";
interface TLEvent { id: string; kind: TLKind; at: string; user: string; title: string; detail?: string; }

const kindMeta: Record<TLKind, { icon: any; bg: string; fg: string }> = {
  created:    { icon: Sparkles,     bg: "bg-primary/15",     fg: "text-primary" },
  status:     { icon: ArrowRight,   bg: "bg-info/15",        fg: "text-info" },
  comment:    { icon: MessageCircle,bg: "bg-violet-500/15",  fg: "text-violet-500" },
  checklist:  { icon: CheckCircle2, bg: "bg-success/15",     fg: "text-success" },
  attachment: { icon: Paperclip,    bg: "bg-muted",          fg: "text-foreground" },
  assigned:   { icon: Flag,         bg: "bg-warning/15",     fg: "text-warning" },
  due:        { icon: Calendar,     bg: "bg-warning/15",     fg: "text-warning" },
  log:        { icon: Clock,        bg: "bg-info/15",        fg: "text-info" },
  completed:  { icon: CheckCircle2, bg: "bg-success/20",     fg: "text-success" },
};

function buildTimeline(task: Task): TLEvent[] {
  const assignee = getUser(task.assigneeId);
  const events: TLEvent[] = [];
  events.push({ id: "ev-c", kind: "created", at: task.createdAt, user: "Sistema", title: "Tarefa criada", detail: "Adicionada ao projeto" });
  if (assignee) events.push({ id: "ev-a", kind: "assigned", at: task.createdAt, user: assignee.name, title: `Atribuída a ${assignee.name}`, detail: assignee.role });
  events.push({ id: "ev-s1", kind: "status", at: task.startDate, user: assignee?.name || "—", title: "Movida para A Fazer", detail: "Backlog → A Fazer" });
  if (task.loggedHours > 0) {
    events.push({ id: "ev-s2", kind: "status", at: task.startDate, user: assignee?.name || "—", title: "Trabalho iniciado", detail: "A Fazer → Em Desenvolvimento" });
    events.push({ id: "ev-log", kind: "log", at: task.startDate, user: assignee?.name || "—", title: `${task.loggedHours}h registradas`, detail: `Estimado: ${task.estimatedHours}h` });
  }
  task.checklist.filter(c => c.done).forEach((c) =>
    events.push({
      id: `ev-cl-${c.id}`, kind: "checklist", at: c.doneAt || task.startDate,
      user: c.doneBy || assignee?.name || "—",
      title: `Concluído: ${c.text}`,
      detail: [c.doneNote, c.doneAt ? `Marcada em ${fmtDateTime(c.doneAt)}` : null].filter(Boolean).join(" · ") || undefined,
    })
  );
  task.comments.forEach(c => {
    const u = getUser(c.userId);
    events.push({ id: `ev-cm-${c.id}`, kind: "comment", at: c.at, user: u?.name || "—", title: "Novo comentário", detail: c.text });
  });
  task.attachments.forEach(a =>
    events.push({ id: `ev-at-${a.id}`, kind: "attachment", at: task.startDate, user: assignee?.name || "—", title: `Anexo: ${a.name}`, detail: a.size })
  );
  if (task.completedAt) {
    events.push({ id: "ev-done", kind: "completed", at: task.completedAt, user: assignee?.name || "—", title: "Tarefa concluída", detail: `Finalizada em ${fmtDateTime(task.completedAt)}` });
  }
  return events.sort((a, b) => a.at.localeCompare(b.at)).reverse();
}

function fmtDate(d: string) {
  try {
    const dt = new Date(d);
    if (d.includes("T")) return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
}
function fmtDateTime(d: string) {
  try {
    const dt = new Date(d);
    if (!d.includes("T")) return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) + " às " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return d; }
}
function fmtLong(d: string) {
  try { return new Date(d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "long" }); }
  catch { return d; }
}

export function TaskDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const [tab, setTab] = useState("descricao");
  const [newComment, setNewComment] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [newChecklist, setNewChecklist] = useState("");
  const [starred, setStarred] = useState(false);

  useEffect(() => {
    if (task) {
      setTitleDraft(task.title);
      setDescDraft(task.description);
      setTab("descricao");
      setEditingTitle(false);
      setEditingDesc(false);
    }
  }, [task?.id]);

  const timeline = useMemo(() => task ? buildTimeline(task) : [], [task]);

  if (!task) return null;
  const project = getProject(task.projectId);
  const assignee = getUser(task.assigneeId);
  const done = task.checklist.filter(c => c.done).length;
  const pct = task.checklist.length ? Math.round((done / task.checklist.length) * 100) : 0;
  const col = COLUMNS.find(c => c.id === task.status);
  const hoursPct = task.estimatedHours ? Math.min(100, (task.loggedHours / task.estimatedHours) * 100) : 0;
  const isOverdue = !task.completedAt && new Date(task.dueDate) < new Date("2026-06-10");

  const saveTitle = () => {
    if (titleDraft.trim() && titleDraft !== task.title) tasksStore.updateTask(task.id, { title: titleDraft.trim() });
    setEditingTitle(false);
  };
  const saveDesc = () => {
    if (descDraft !== task.description) tasksStore.updateTask(task.id, { description: descDraft });
    setEditingDesc(false);
  };
  const addChecklist = () => {
    if (!newChecklist.trim()) return;
    tasksStore.updateTask(task.id, {
      checklist: [...task.checklist, { id: `c${Date.now()}`, text: newChecklist.trim(), done: false }],
    });
    setNewChecklist("");
  };
  const postComment = () => {
    if (!newComment.trim()) return;
    tasksStore.updateTask(task.id, {
      comments: [...task.comments, { id: `cm${Date.now()}`, userId: "u1", text: newComment.trim(), at: new Date().toISOString().slice(0,10) }],
    });
    setNewComment("");
  };
  const toggleChecklist = (cid: string, v: boolean) => {
    tasksStore.updateTask(task.id, {
      checklist: task.checklist.map(x => x.id === cid ? { ...x, done: v, doneAt: v ? new Date().toISOString() : undefined } : x),
    });
  };
  const completeTask = () => tasksStore.moveTask(task.id, "concluido");
  const allDone = task.checklist.length > 0 && done === task.checklist.length;

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl w-[96vw] p-0 gap-0 overflow-hidden max-h-[94vh] border-border/60 shadow-2xl">
        {/* Cover */}
        <div className="relative h-32 shrink-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${project?.color} 0%, color-mix(in oklab, ${project?.color} 40%, transparent) 60%, transparent 100%)` }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.18),transparent_50%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.08),transparent_50%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

          {/* Top bar */}
          <div className="relative z-10 flex items-center justify-between px-6 pt-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur px-2.5 py-1 border border-border/50">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: project?.color }} />
                <span className="font-medium">{project?.name}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur px-2.5 py-1 border border-border/50 text-muted-foreground">
                <Building2 className="h-3 w-3" /> {task.department}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur px-2.5 py-1 border border-border/50 font-mono text-[11px] text-muted-foreground">
                <Hash className="h-3 w-3" />{task.id.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8 bg-background/60 backdrop-blur hover:bg-background" onClick={() => setStarred(s => !s)}>
                <Star className={`h-3.5 w-3.5 ${starred ? "fill-warning text-warning" : ""}`} />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 bg-background/60 backdrop-blur hover:bg-background"><Eye className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 bg-background/60 backdrop-blur hover:bg-background"><Share2 className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 bg-background/60 backdrop-blur hover:bg-background"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 bg-background/60 backdrop-blur hover:bg-background" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </div>

        {/* Title block (overlapping cover) */}
        <div className="px-6 -mt-14 relative z-10">
          <div className="rounded-xl border border-border bg-card shadow-sm p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in oklab, ${project?.color} 18%, transparent)`, color: project?.color }}>
                <CheckSquare2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                {editingTitle ? (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setTitleDraft(task.title); setEditingTitle(false); } }}
                      className="text-xl font-semibold h-10"
                    />
                    <Button size="sm" onClick={saveTitle}><Save className="h-3.5 w-3.5" /></Button>
                  </div>
                ) : (
                  <button onClick={() => setEditingTitle(true)} className="group flex items-center gap-2 text-left w-full">
                    <h2 className="text-2xl font-semibold tracking-tight leading-tight">{task.title}</h2>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Select value={task.status} onValueChange={(v) => tasksStore.moveTask(task.id, v)}>
                    <SelectTrigger className="h-7 w-auto gap-1.5 text-xs font-medium rounded-full bg-primary/10 border-primary/20 text-primary hover:bg-primary/15">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                  </Select>
                  <PriorityBadge p={task.priority} />
                  <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${isOverdue ? "bg-destructive/15 text-destructive" : "bg-muted"}`}>
                    <AlarmClock className="h-3 w-3" /> {fmtLong(task.dueDate)}
                    {isOverdue && <span className="font-semibold">· atrasada</span>}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted">
                    <Clock className="h-3 w-3" /> {task.loggedHours}h / {task.estimatedHours}h
                  </span>
                  {task.tags.map(t => (
                    <span key={t} className="text-xs rounded-full bg-muted/70 px-2 py-1 font-medium text-muted-foreground">#{t}</span>
                  ))}
                </div>
                {task.checklist.length > 0 && (
                  <div className="mt-3 flex items-center gap-3">
                    <Progress value={pct} className="h-1.5 flex-1" />
                    <span className="text-[11px] font-semibold tabular-nums text-muted-foreground whitespace-nowrap">
                      {done}/{task.checklist.length} subtarefas · {pct}%
                    </span>
                  </div>
                )}
                {task.completedAt && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 border border-success/30 rounded-full px-2.5 py-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Concluída em {fmtDateTime(task.completedAt)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px_320px] overflow-hidden mt-4" style={{ maxHeight: "calc(94vh - 260px)" }}>
          {/* Main */}
          <div className="overflow-y-auto">
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <div className="px-6 pt-2 border-b border-border sticky top-0 bg-background z-10">
                <TabsList className="bg-transparent p-0 h-auto gap-1 flex-wrap">
                  <TabsTrigger value="descricao" className="data-[state=active]:bg-muted rounded-md text-xs"><FileText className="h-3.5 w-3.5 mr-1.5" />Descrição</TabsTrigger>
                  <TabsTrigger value="subtarefas" className="data-[state=active]:bg-muted rounded-md text-xs"><CheckSquare2 className="h-3.5 w-3.5 mr-1.5" />Subtarefas <span className="ml-1.5 text-[10px] bg-muted px-1.5 rounded-full">{done}/{task.checklist.length}</span></TabsTrigger>
                  <TabsTrigger value="comentarios" className="data-[state=active]:bg-muted rounded-md text-xs"><MessageSquare className="h-3.5 w-3.5 mr-1.5" />Comentários <span className="ml-1.5 text-[10px] bg-muted px-1.5 rounded-full">{task.comments.length}</span></TabsTrigger>
                  <TabsTrigger value="anexos" className="data-[state=active]:bg-muted rounded-md text-xs"><Paperclip className="h-3.5 w-3.5 mr-1.5" />Anexos <span className="ml-1.5 text-[10px] bg-muted px-1.5 rounded-full">{task.attachments.length}</span></TabsTrigger>
                  <TabsTrigger value="timeline" className="data-[state=active]:bg-muted rounded-md text-xs md:hidden"><ActivityIcon className="h-3.5 w-3.5 mr-1.5" />Histórico <span className="ml-1.5 text-[10px] bg-muted px-1.5 rounded-full">{timeline.length}</span></TabsTrigger>
                </TabsList>
              </div>

              {/* DESCRIÇÃO */}
              <TabsContent value="descricao" className="px-6 py-5 space-y-5 mt-0">
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição</h4>
                    {!editingDesc && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingDesc(true)}>
                        <Pencil className="h-3 w-3" /> Editar
                      </Button>
                    )}
                  </div>
                  {editingDesc ? (
                    <div className="space-y-2">
                      <Textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} className="min-h-32" placeholder="Descreva o objetivo, contexto e critérios de aceitação..." />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => { setDescDraft(task.description); setEditingDesc(false); }}>Cancelar</Button>
                        <Button size="sm" onClick={saveDesc}><Save className="h-3.5 w-3.5" /> Salvar</Button>
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => setEditingDesc(true)} className="rounded-lg border border-dashed border-border/60 p-4 cursor-text hover:border-primary/40 hover:bg-muted/30 transition-colors min-h-24">
                      <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                        {task.description || <span className="text-muted-foreground italic">Clique para adicionar uma descrição rica...</span>}
                      </p>
                    </div>
                  )}
                </section>

                <section className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Progresso</div>
                    <div className="text-xl font-semibold">{pct}%</div>
                    <Progress value={pct} className="h-1 mt-2" />
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Tempo</div>
                    <div className="text-xl font-semibold">{task.loggedHours}<span className="text-xs text-muted-foreground font-normal">/{task.estimatedHours}h</span></div>
                    <Progress value={hoursPct} className="h-1 mt-2" />
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Comentários</div>
                    <div className="text-xl font-semibold">{task.comments.length}</div>
                    <div className="text-[11px] text-muted-foreground mt-2">{task.attachments.length} anexo(s)</div>
                  </div>
                </section>
              </TabsContent>

              {/* SUBTAREFAS */}
              <TabsContent value="subtarefas" className="px-6 py-5 mt-0 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Checklist</h4>
                  <span className="text-xs font-medium text-muted-foreground">{done}/{task.checklist.length} concluídas · {pct}%</span>
                </div>
                <Progress value={pct} className="h-1.5" />
                {allDone && task.status !== "concluido" && (
                  <div className="rounded-lg border border-success/40 bg-success/10 p-3 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    <div className="flex-1 min-w-40 text-sm">
                      <span className="font-semibold">Todas as subtarefas concluídas!</span>{" "}
                      <span className="text-muted-foreground">Você já pode finalizar esta tarefa.</span>
                    </div>
                    <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={completeTask}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Concluir Tarefa
                    </Button>
                  </div>
                )}
                {task.completedAt && (
                  <div className="rounded-lg border border-success/40 bg-success/10 p-3 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    <div className="text-sm">
                      <span className="font-semibold">Tarefa concluída</span>{" "}
                      <span className="text-muted-foreground">em {fmtDateTime(task.completedAt)}</span>
                    </div>
                  </div>
                )}
                <ul className="space-y-1">
                  {task.checklist.map(c => (
                    <li key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group border border-transparent hover:border-border">
                      <Checkbox checked={c.done} onCheckedChange={(v) => toggleChecklist(c.id, !!v)} />
                      <span className={`text-sm flex-1 ${c.done ? "line-through text-muted-foreground" : ""}`}>{c.text}</span>
                      {c.done && c.doneAt && (
                        <span className="text-[10px] text-success font-medium whitespace-nowrap inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {fmtDate(c.doneAt)}
                        </span>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={() => tasksStore.updateTask(task.id, { checklist: task.checklist.filter(x => x.id !== c.id) })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Input value={newChecklist} onChange={(e) => setNewChecklist(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addChecklist()}
                    placeholder="Adicionar nova subtarefa..." className="h-9" />
                  <Button size="sm" onClick={addChecklist}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
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
                        <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2 border border-border/50">
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
                    <li className="text-center py-12 text-sm text-muted-foreground rounded-lg border-2 border-dashed border-border">
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
                    <Button size="sm" disabled={!newComment.trim()} onClick={postComment}><Send className="h-3 w-3" /> Comentar</Button>
                  </div>
                </div>
              </TabsContent>

              {/* ANEXOS */}
              <TabsContent value="anexos" className="px-6 py-5 mt-0">
                {task.attachments.length > 0 ? (
                  <ul className="grid grid-cols-2 gap-2">
                    {task.attachments.map(a => (
                      <li key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 transition-colors">
                        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center"><FileText className="h-4 w-4" /></div>
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
                    Arraste arquivos aqui ou <span className="text-primary cursor-pointer font-medium">clique para anexar</span>
                  </div>
                )}
              </TabsContent>

              {/* TIMELINE */}
              <TabsContent value="timeline" className="px-6 py-5 mt-0">
                <div className="relative">
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
                  <ul className="space-y-3">
                    {timeline.map((e) => {
                      const m = kindMeta[e.kind]; const Icon = m.icon;
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
            </Tabs>
          </div>

          {/* Timeline column (always visible on md+) */}
          <div className="hidden md:flex flex-col border-l border-border bg-gradient-to-b from-muted/10 to-muted/30 overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-border/60 bg-background/40 backdrop-blur sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-primary/15 text-primary flex items-center justify-center">
                  <ActivityIcon className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold leading-none">Timeline</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{timeline.length} eventos</div>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ao vivo</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="relative">
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-border to-transparent" />
                <ul className="space-y-2.5">
                  {timeline.map((e) => {
                    const m = kindMeta[e.kind]; const Icon = m.icon;
                    return (
                      <li key={e.id} className="relative pl-10">
                        <span className={`absolute left-0 top-0.5 h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-background ${m.bg}`}>
                          <Icon className={`h-3.5 w-3.5 ${m.fg}`} />
                        </span>
                        <div className="rounded-lg border border-border/60 bg-card/70 backdrop-blur p-2.5 hover:bg-card hover:border-border transition-all">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-xs font-semibold leading-tight">{e.title}</div>
                            <div className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">{fmtDate(e.at)}</div>
                          </div>
                          {e.detail && <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-snug">{e.detail}</div>}
                          <div className="mt-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                            <span className="font-medium text-foreground/70">{e.user}</span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="border-l border-border bg-muted/20 p-5 space-y-4 overflow-y-auto">

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Responsável</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-full flex items-center gap-2.5 rounded-lg border border-border p-2 bg-background hover:border-primary/40 transition-colors">
                    {assignee && <UserAvatar id={assignee.id} size={32} />}
                    <div className="text-sm min-w-0 flex-1 text-left">
                      <div className="font-medium truncate">{assignee?.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{assignee?.role}</div>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-1 w-64">
                  <div className="max-h-64 overflow-auto">
                    {users.map(u => (
                      <button key={u.id} onClick={() => tasksStore.updateTask(task.id, { assigneeId: u.id })}
                        className={`w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-left ${u.id === task.assigneeId ? "bg-muted" : ""}`}>
                        <UserAvatar id={u.id} size={24} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{u.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{u.role}</div>
                        </div>
                        {u.id === task.assigneeId && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Prioridade</label>
              <Select value={task.priority} onValueChange={(v: any) => tasksStore.updateTask(task.id, { priority: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(priorityMeta).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Início</label>
                <Input type="date" value={task.startDate} onChange={(e) => tasksStore.updateTask(task.id, { startDate: e.target.value })} className="h-9 text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Prazo</label>
                <Input type="date" value={task.dueDate} onChange={(e) => tasksStore.updateTask(task.id, { dueDate: e.target.value })} className="h-9 text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Estimado</label>
                <Input type="number" value={task.estimatedHours} onChange={(e) => tasksStore.updateTask(task.id, { estimatedHours: +e.target.value })} className="h-9 text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Registrado</label>
                <Input type="number" value={task.loggedHours} onChange={(e) => tasksStore.updateTask(task.id, { loggedHours: +e.target.value })} className="h-9 text-xs" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block flex items-center gap-1.5"><UsersIcon className="h-3 w-3" /> Participantes</label>
              <div className="flex -space-x-2">
                {task.participantIds.map(id => <div key={id} className="ring-2 ring-background rounded-full"><UserAvatar id={id} size={28} /></div>)}
                <button className="h-7 w-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary bg-background">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block flex items-center gap-1.5"><Tag className="h-3 w-3" /> Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map(t => <span key={t} className="text-xs rounded-md bg-background border border-border px-2 py-1 font-medium">#{t}</span>)}
                <button className="text-xs rounded-md border border-dashed border-border px-2 py-1 text-muted-foreground hover:border-primary hover:text-primary"><Plus className="h-3 w-3 inline" /> Adicionar</button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Linhagem</label>
              <div className="rounded-md border border-border bg-background divide-y divide-border text-xs">
                <div className="flex justify-between items-center px-2.5 py-2"><span className="text-muted-foreground">Criada</span><span>{fmtDate(task.createdAt)}</span></div>
                {task.completedAt && <div className="flex justify-between items-center px-2.5 py-2"><span className="text-muted-foreground">Concluída</span><span className="text-success font-medium">{fmtDateTime(task.completedAt)}</span></div>}
                <div className="flex justify-between items-center px-2.5 py-2"><span className="text-muted-foreground flex items-center gap-1"><GitBranch className="h-3 w-3" /> Projeto</span><span className="font-medium truncate ml-2">{project?.name}</span></div>
              </div>
            </div>
          </aside>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-background px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm"><PlayCircle className="h-3.5 w-3.5" /> Iniciar timer</Button>
            <Button variant="outline" size="sm"><Link2 className="h-3.5 w-3.5" /> Copiar link</Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Excluir</Button>
          </div>
          <div className="flex items-center gap-2">
            {task.status !== "concluido" && task.checklist.length > 0 && done < task.checklist.length && (
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                Finalize as subtarefas para concluir ({done}/{task.checklist.length})
              </span>
            )}
            {task.completedAt && (
              <span className="text-[11px] text-success font-medium hidden sm:inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Concluída em {fmtDateTime(task.completedAt)}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
            {["backlog", "todo", "analise"].includes(task.status) && (
              <Button
                size="sm"
                className="bg-info text-info-foreground hover:bg-info/90"
                onClick={() => tasksStore.moveTask(task.id, "dev")}
              >
                <PlayCircle className="h-3.5 w-3.5" /> Iniciar Tarefa
              </Button>
            )}
            {task.status !== "concluido" ? (
              <Button
                size="sm"
                disabled={task.checklist.length > 0 && done < task.checklist.length}
                className={allDone ? "bg-success text-success-foreground hover:bg-success/90 animate-in fade-in zoom-in-95 duration-300" : ""}
                onClick={completeTask}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Concluir Tarefa
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => tasksStore.moveTask(task.id, "dev")}>
                <ArrowRight className="h-3.5 w-3.5" /> Reabrir
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
