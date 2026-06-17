import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CalendarDays, FileStack, Sparkles, FileText, ListChecks, CheckCircle2, ArrowRight, ArrowLeft, X, Palette, Plus, Trash2, GitBranch } from "lucide-react";
import { templatesStore } from "@/lib/store";
import { priorityMeta, type Priority, type ProjectTemplate, type TemplateTask } from "@/lib/mock-data";
import wizardBg from "@/assets/wizard-bg.jpg";

const STEPS = [
  { id: 0, title: "Identidade", desc: "Nome, ícone e cor", icon: FileStack },
  { id: 1, title: "Descrição", desc: "Categoria e duração", icon: FileText },
  { id: 2, title: "Tarefas", desc: "Estrutura do projeto", icon: ListChecks },
  { id: 3, title: "Revisão", desc: "Confirme e salve", icon: CheckCircle2 },
];

const COLORS = [
  "oklch(0.6 0.18 260)", "oklch(0.65 0.18 25)", "oklch(0.62 0.16 155)",
  "oklch(0.7 0.18 340)", "oklch(0.65 0.14 230)", "oklch(0.7 0.15 70)",
  "oklch(0.6 0.2 295)", "oklch(0.65 0.15 190)",
];

const ICONS = ["📋", "🏥", "📣", "💻", "👋", "🛡️", "🎉", "📊", "🚀", "⚙️", "📦", "🎯", "💼", "🔧", "📅"];
const CATEGORIES: ProjectTemplate["category"][] = ["Operações", "Marketing", "TI", "RH", "Financeiro", "Geral"];

export function CreateTemplateWizard({ open, template, onClose }: { open: boolean; template?: ProjectTemplate | null; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [category, setCategory] = useState<ProjectTemplate["category"]>("Geral");
  const [duration, setDuration] = useState(30);
  const [tasks, setTasks] = useState<TemplateTask[]>([{ title: "Primeira tarefa", priority: "normal", offsetStartDays: 0, offsetDueDays: 5, estimatedHours: 8 }]);

  useEffect(() => {
    if (template) {
      setName(template.name); setDescription(template.description); setIcon(template.icon); setColor(template.color);
      setCategory(template.category); setDuration(template.defaultDurationDays); setTasks(template.tasks);
    } else {
      setName(""); setDescription(""); setIcon(ICONS[0]); setColor(COLORS[0]);
      setCategory("Geral"); setDuration(30); setTasks([{ title: "Primeira tarefa", priority: "normal", offsetStartDays: 0, offsetDueDays: 5, estimatedHours: 8 }]);
    }
    setStep(0);
  }, [template, open]);

  const close = () => { onClose(); };

  const submit = () => {
    if (!name.trim()) return;
    const payload: ProjectTemplate = {
      id: template?.id || `tpl_${Date.now().toString(36)}`,
      name: name.trim(), description: description.trim(), icon, color, category,
      defaultDurationDays: duration, tasks,
    };
    if (template) templatesStore.updateTemplate(template.id, payload);
    else templatesStore.addTemplate(payload);
    close();
  };

  const updateTask = (i: number, patch: Partial<TemplateTask>) => setTasks(ts => ts.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  const removeTask = (i: number) => setTasks(ts => ts.filter((_, idx) => idx !== i));
  const addTask = () => setTasks(ts => [...ts, { title: "Nova tarefa", priority: "normal", offsetStartDays: 0, offsetDueDays: 5, estimatedHours: 4 }]);
  const toggleDep = (i: number, dep: number) => updateTask(i, {
    dependsOnIndex: (tasks[i].dependsOnIndex || []).includes(dep)
      ? tasks[i].dependsOnIndex!.filter(x => x !== dep)
      : [...(tasks[i].dependsOnIndex || []), dep]
  });

  const canNext = step === 0 ? name.trim().length > 0 : step === 2 ? tasks.length > 0 : true;
  const prettyDate = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0 border-0 [&>button]:hidden">
        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] min-h-[640px]">
          <aside
            className="relative hidden md:flex flex-col justify-between p-7 text-white overflow-hidden"
            style={{ backgroundImage: `url(${wizardBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-black/55 via-black/40 to-black/70" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-[11px] font-medium border border-white/20">
                <Sparkles className="h-3 w-3" /> {template ? "Editar template" : "Novo template"}
              </div>
              <h2 className="mt-5 text-2xl font-semibold leading-tight">Modelos reaproveitáveis<br />para acelerar projetos.</h2>
              <p className="mt-2 text-sm text-white/75 capitalize">{prettyDate}</p>
            </div>
            <ol className="relative space-y-1">
              {STEPS.map((s, i) => {
                const Icon = s.icon; const active = i === step; const done = i < step;
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => { if (i <= step) setStep(i); }}
                      className={`relative w-full flex items-start gap-3 rounded-xl p-3 text-left transition-all ${active ? "bg-white/15 backdrop-blur border border-white/25" : "hover:bg-white/5 border border-transparent"}`}>
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${done ? "bg-emerald-400/90 border-emerald-300 text-emerald-950" : active ? "bg-white text-primary border-white" : "bg-white/10 border-white/20 text-white/70"}`}>
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
                <CalendarDays className="h-4 w-4" /><span className="capitalize">{prettyDate}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={close}><X className="h-4 w-4" /></Button>
            </div>

            <div className="flex-1 px-7 py-6 overflow-y-auto">
              {step === 0 && (
                <div className="space-y-5">
                  <div><h3 className="text-xl font-semibold">Identidade do template</h3><p className="text-sm text-muted-foreground mt-1">Nome, ícone e cor para identificar.</p></div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nome</Label>
                    <Input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Lançamento de produto" className="mt-2 h-12 text-base" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Ícone</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ICONS.map(i => (
                        <button key={i} type="button" onClick={() => setIcon(i)}
                          className={`h-11 w-11 rounded-xl border text-xl transition-all ${icon === i ? "border-primary bg-primary/10 scale-110" : "border-border hover:border-primary/40"}`}>
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> Cor</Label>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {COLORS.map(c => (
                        <button key={c} type="button" onClick={() => setColor(c)}
                          className={`h-10 w-10 rounded-xl transition-all ${color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div><h3 className="text-xl font-semibold">Categoria e duração</h3><p className="text-sm text-muted-foreground mt-1">Defina o tipo e prazo padrão.</p></div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Descrição</Label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Para que serve esse template?" className="mt-2 min-h-24" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Categoria</Label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {CATEGORIES.map(c => (
                        <button key={c} type="button" onClick={() => setCategory(c)}
                          className={`rounded-lg border p-3 text-sm font-medium transition-all ${category === c ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Duração padrão (dias)</Label>
                    <Input type="number" min={1} value={duration} onChange={e => setDuration(Number(e.target.value))} className="mt-2 h-11 w-32" />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><h3 className="text-xl font-semibold">Tarefas do template</h3><p className="text-sm text-muted-foreground mt-1">{tasks.length} tarefa(s). Use offsets em dias a partir do início.</p></div>
                    <Button size="sm" onClick={addTask}><Plus className="h-4 w-4 mr-1" /> Tarefa</Button>
                  </div>
                  <ul className="space-y-3">
                    {tasks.map((t, i) => (
                      <li key={i} className="rounded-xl border border-border bg-card/40 p-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">{i+1}</span>
                          <div className="flex-1 space-y-2">
                            <Input value={t.title} onChange={e => updateTask(i, { title: e.target.value })} placeholder="Título da tarefa" className="h-9" />
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                              <div>
                                <Label className="text-[10px] uppercase text-muted-foreground">Depto</Label>
                                <Input value={t.department || ""} onChange={e => updateTask(i, { department: e.target.value })} placeholder="Geral" className="h-8 text-xs" />
                              </div>
                              <div>
                                <Label className="text-[10px] uppercase text-muted-foreground">Prioridade</Label>
                                <select value={t.priority || "normal"} onChange={e => updateTask(i, { priority: e.target.value as Priority })}
                                  className="h-8 w-full text-xs rounded-md border border-input bg-background px-2">
                                  {Object.keys(priorityMeta).map(p => <option key={p} value={p}>{priorityMeta[p as Priority].label}</option>)}
                                </select>
                              </div>
                              <div>
                                <Label className="text-[10px] uppercase text-muted-foreground">Início (+d)</Label>
                                <Input type="number" value={t.offsetStartDays ?? 0} onChange={e => updateTask(i, { offsetStartDays: Number(e.target.value) })} className="h-8 text-xs" />
                              </div>
                              <div>
                                <Label className="text-[10px] uppercase text-muted-foreground">Prazo (+d)</Label>
                                <Input type="number" value={t.offsetDueDays ?? 5} onChange={e => updateTask(i, { offsetDueDays: Number(e.target.value) })} className="h-8 text-xs" />
                              </div>
                              <div>
                                <Label className="text-[10px] uppercase text-muted-foreground">Horas</Label>
                                <Input type="number" value={t.estimatedHours ?? 0} onChange={e => updateTask(i, { estimatedHours: Number(e.target.value) })} className="h-8 text-xs" />
                              </div>
                            </div>
                            {i > 0 && (
                              <div>
                                <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><GitBranch className="h-3 w-3" /> Depende de</Label>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {tasks.slice(0, i).map((dt, di) => {
                                    const sel = (t.dependsOnIndex || []).includes(di);
                                    return (
                                      <button key={di} type="button" onClick={() => toggleDep(i, di)}
                                        className={`text-[10px] rounded-full px-2 py-0.5 border transition-colors ${sel ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                                        #{di+1} {dt.title.slice(0, 20)}{dt.title.length > 20 ? "…" : ""}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => removeTask(i)} className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div><h3 className="text-xl font-semibold">Tudo certo?</h3><p className="text-sm text-muted-foreground mt-1">Revise antes de salvar.</p></div>
                  <div className="rounded-xl border bg-card/40 p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="h-12 w-12 rounded-lg flex items-center justify-center text-2xl" style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)` }}>{icon}</span>
                      <div>
                        <div className="text-base font-semibold">{name}</div>
                        <div className="text-xs text-muted-foreground">{category} · {duration} dias · {tasks.length} tarefas</div>
                      </div>
                    </div>
                    {description && <p className="text-sm text-muted-foreground">{description}</p>}
                    <div className="h-px bg-border" />
                    <ol className="space-y-1.5 text-sm">
                      {tasks.map((t, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold w-5 text-muted-foreground">{i+1}.</span>
                          <span>{t.title}</span>
                          <span className="text-[10px] text-muted-foreground">· d{t.offsetStartDays}–d{t.offsetDueDays} · {t.estimatedHours}h</span>
                          {(t.dependsOnIndex?.length || 0) > 0 && <span className="text-[10px] text-primary">↳ depende de #{t.dependsOnIndex!.map(x => x+1).join(", #")}</span>}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t px-7 py-4 bg-muted/30">
              <Button variant="ghost" onClick={step === 0 ? close : () => setStep(s => s - 1)}>
                {step === 0 ? "Cancelar" : (<><ArrowLeft className="h-4 w-4" /> Voltar</>)}
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep(s => s + 1)} disabled={!canNext}>Continuar <ArrowRight className="h-4 w-4" /></Button>
              ) : (
                <Button onClick={submit} disabled={!name.trim()}><CheckCircle2 className="h-4 w-4" /> {template ? "Salvar alterações" : "Criar template"}</Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
