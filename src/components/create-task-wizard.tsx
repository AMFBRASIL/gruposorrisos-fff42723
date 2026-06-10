import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays, FileText, Users as UsersIcon, Layers, Flag, CheckCircle2,
  Sparkles, ArrowRight, ArrowLeft, X,
} from "lucide-react";
import { projects, users, COLUMNS, priorityMeta, type Priority } from "@/lib/mock-data";
import { tasksStore } from "@/lib/store";
import wizardBg from "@/assets/wizard-bg.jpg";

const STEPS = [
  { id: 0, title: "Identidade", desc: "Dê um nome claro à tarefa", icon: FileText },
  { id: 1, title: "Contexto", desc: "Projeto e descrição", icon: Layers },
  { id: 2, title: "Pessoas", desc: "Quem vai executar", icon: UsersIcon },
  { id: 3, title: "Prioridade", desc: "Urgência e coluna", icon: Flag },
  { id: 4, title: "Revisão", desc: "Confirme e crie", icon: CheckCircle2 },
];

export type CreateTaskWizardProps = {
  open: boolean;
  onClose: () => void;
  /** ISO date (yyyy-mm-dd). Defaults to today (2026-06-10). */
  dueDate?: string | null;
  /** Pre-selected Kanban column id. */
  defaultStatus?: string;
};

export function CreateTaskWizard({ open, onClose, dueDate, defaultStatus }: CreateTaskWizardProps) {
  const iso = dueDate ?? "2026-06-10";
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(projects[0].id);
  const [assigneeId, setAssigneeId] = useState(users[0].id);
  const [priority, setPriority] = useState<Priority>("normal");
  const [status, setStatus] = useState(defaultStatus ?? COLUMNS[1].id);
  const [estimatedHours, setEstimatedHours] = useState("4");

  const prettyDate = new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  const reset = () => {
    setStep(0);
    setTitle(""); setDescription(""); setProjectId(projects[0].id);
    setAssigneeId(users[0].id); setPriority("normal");
    setStatus(defaultStatus ?? COLUMNS[1].id); setEstimatedHours("4");
  };

  const close = () => { reset(); onClose(); };

  const submit = () => {
    if (!title.trim()) return;
    const id = `t_${Date.now().toString(36)}`;
    tasksStore.addTask({
      id, title: title.trim(), description: description.trim(),
      projectId, assigneeId, participantIds: [assigneeId],
      department: users.find(u => u.id === assigneeId)?.department ?? "",
      tags: [], priority, status,
      createdAt: "2026-06-10", startDate: "2026-06-10", dueDate: iso,
      checklist: [], comments: [], attachments: [],
      estimatedHours: Number(estimatedHours) || 0, loggedHours: 0,
    });
    close();
  };

  const canNext = step === 0 ? title.trim().length > 0 : true;
  const project = projects.find(p => p.id === projectId);
  const assignee = users.find(u => u.id === assigneeId);
  const column = COLUMNS.find(c => c.id === status);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0 border-0 [&>button]:hidden">
        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] min-h-[600px]">
          <aside
            className="relative hidden md:flex flex-col justify-between p-7 text-white overflow-hidden"
            style={{ backgroundImage: `url(${wizardBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-black/55 via-black/40 to-black/70" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-[11px] font-medium border border-white/20">
                <Sparkles className="h-3 w-3" /> Nova tarefa
              </div>
              <h2 className="mt-5 text-2xl font-semibold leading-tight">
                Crie tarefas com<br />intenção e clareza.
              </h2>
              <p className="mt-2 text-sm text-white/75 capitalize">{prettyDate}</p>
            </div>

            <ol className="relative space-y-1">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const active = i === step;
                const done = i < step;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => { if (i <= step) setStep(i); }}
                      className={`relative w-full flex items-start gap-3 rounded-xl p-3 text-left transition-all ${
                        active ? "bg-white/15 backdrop-blur border border-white/25" : "hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                        done ? "bg-emerald-400/90 border-emerald-300 text-emerald-950"
                        : active ? "bg-white text-primary border-white"
                        : "bg-white/10 border-white/20 text-white/70"
                      }`}>
                        {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <div className={`text-sm font-medium ${active ? "text-white" : "text-white/85"}`}>{s.title}</div>
                        <div className="text-[11px] text-white/60 leading-tight mt-0.5">{s.desc}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="relative text-[11px] text-white/60">
              Passo {step + 1} de {STEPS.length}
              <div className="mt-2 h-1 w-full rounded-full bg-white/15 overflow-hidden">
                <div className="h-full bg-white transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
              </div>
            </div>
          </aside>

          <div className="flex flex-col">
            <div className="flex items-center justify-between px-7 pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span className="capitalize">{prettyDate}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={close}><X className="h-4 w-4" /></Button>
            </div>

            <div className="flex-1 px-7 py-6 overflow-y-auto">
              <div key={step} className="animate-fade-in">
                {step === 0 && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-semibold">Qual é a tarefa?</h3>
                      <p className="text-sm text-muted-foreground mt-1">Um bom título descreve o resultado esperado em poucas palavras.</p>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Título</Label>
                      <Input
                        autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ex.: Revisar contrato com fornecedor"
                        className="mt-2 h-12 text-base"
                      />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Horas estimadas</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Input type="number" min="0" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} className="w-28 h-11" />
                        <span className="text-sm text-muted-foreground">horas</span>
                      </div>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-semibold">Em qual contexto?</h3>
                      <p className="text-sm text-muted-foreground mt-1">Vincule a um projeto e descreva o que precisa ser feito.</p>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Projeto</Label>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                        {projects.map(p => (
                          <button
                            key={p.id} type="button" onClick={() => setProjectId(p.id)}
                            className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                              projectId === p.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"
                            }`}
                          >
                            <span className="h-8 w-8 rounded-md shrink-0" style={{ backgroundColor: p.color }} />
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{p.name}</div>
                              <div className="text-[11px] text-muted-foreground truncate">{p.status}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Descrição</Label>
                      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes, contexto, links..." className="mt-2 min-h-28" />
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-semibold">Quem vai executar?</h3>
                      <p className="text-sm text-muted-foreground mt-1">Selecione o responsável principal pela tarefa.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                      {users.map(u => (
                        <button
                          key={u.id} type="button" onClick={() => setAssigneeId(u.id)}
                          className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                            assigneeId === u.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"
                          }`}
                        >
                          <span className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0" style={{ backgroundColor: u.color }}>
                            {u.initials}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{u.name}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{u.role} · {u.department}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold">Qual a urgência?</h3>
                      <p className="text-sm text-muted-foreground mt-1">Defina a prioridade e em qual coluna do Kanban irá aparecer.</p>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Prioridade</Label>
                      <div className="mt-2 grid grid-cols-5 gap-2">
                        {(["baixa","normal","alta","urgente","critica"] as Priority[]).map(p => (
                          <button
                            key={p} type="button" onClick={() => setPriority(p)}
                            className={`rounded-lg border p-3 text-center transition-all ${
                              priority === p ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"
                            }`}
                          >
                            <span className={`inline-block text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 ${priorityMeta[p].className}`}>{priorityMeta[p].label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Coluna do Kanban</Label>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {COLUMNS.map(c => (
                          <button
                            key={c.id} type="button" onClick={() => setStatus(c.id)}
                            className={`rounded-lg border p-3 text-left transition-all ${
                              status === c.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className="text-sm font-medium">{c.title}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-semibold">Tudo certo?</h3>
                      <p className="text-sm text-muted-foreground mt-1">Revise as informações antes de criar a tarefa.</p>
                    </div>
                    <div className="rounded-xl border bg-card/40 p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <span className="h-10 w-10 rounded-lg shrink-0" style={{ backgroundColor: project?.color }} />
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-semibold truncate">{title || "Sem título"}</div>
                          <div className="text-xs text-muted-foreground">{project?.name}</div>
                          {description && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{description}</p>}
                        </div>
                      </div>
                      <div className="h-px bg-border" />
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <Field label="Responsável">
                          <div className="flex items-center gap-2">
                            <span className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold" style={{ backgroundColor: assignee?.color }}>{assignee?.initials}</span>
                            <span>{assignee?.name}</span>
                          </div>
                        </Field>
                        <Field label="Coluna"><Badge variant="secondary">{column?.title}</Badge></Field>
                        <Field label="Prioridade"><span className={`text-xs font-semibold uppercase rounded px-1.5 py-0.5 ${priorityMeta[priority].className}`}>{priorityMeta[priority].label}</span></Field>
                        <Field label="Prazo"><span className="capitalize">{prettyDate}</span></Field>
                        <Field label="Estimativa">{estimatedHours}h</Field>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t px-7 py-4 bg-muted/30">
              <Button variant="ghost" onClick={step === 0 ? close : () => setStep(s => s - 1)}>
                {step === 0 ? "Cancelar" : (<><ArrowLeft className="h-4 w-4" /> Voltar</>)}
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep(s => s + 1)} disabled={!canNext}>
                  Continuar <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={submit} disabled={!title.trim()}>
                  <CheckCircle2 className="h-4 w-4" /> Criar tarefa
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}
