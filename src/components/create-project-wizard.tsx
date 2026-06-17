import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays, FolderKanban, Users as UsersIcon, FileText, Flag, CheckCircle2,
  Sparkles, ArrowRight, ArrowLeft, X, Palette, Crown, Rocket, PauseCircle, Compass,
  Zap, Flame, AlertTriangle, Circle, ChevronRight, LayoutTemplate, FileEdit,
} from "lucide-react";
import { users, priorityMeta, projectTemplates, type Priority, type Project, type ProjectTemplate } from "@/lib/mock-data";
import { projectsStore, applyTemplateToProject } from "@/lib/store";
import wizardBg from "@/assets/wizard-bg.jpg";

const STEPS = [
  { id: 0, title: "Identidade", desc: "Template, nome e cor", icon: FolderKanban },
  { id: 1, title: "Contexto", desc: "Descrição e status", icon: FileText },
  { id: 2, title: "Equipe", desc: "Responsável e membros", icon: UsersIcon },
  { id: 3, title: "Planejamento", desc: "Prazos e prioridade", icon: Flag },
  { id: 4, title: "Revisão", desc: "Confirme e crie", icon: CheckCircle2 },
];

const COLORS = [
  "oklch(0.6 0.18 260)", "oklch(0.65 0.18 25)", "oklch(0.62 0.16 155)",
  "oklch(0.7 0.18 340)", "oklch(0.65 0.14 230)", "oklch(0.7 0.15 70)",
  "oklch(0.6 0.2 295)", "oklch(0.65 0.15 190)",
];

const STATUS_OPTIONS: { id: Project["status"]; label: string; desc: string; icon: typeof Rocket; tone: string }[] = [
  { id: "planejamento", label: "Planejamento", desc: "Definindo escopo, equipe e cronograma inicial.", icon: Compass, tone: "info" },
  { id: "andamento", label: "Em andamento", desc: "Execução já iniciada com entregas em curso.", icon: Rocket, tone: "success" },
  { id: "pausado", label: "Pausado", desc: "Temporariamente parado aguardando decisão.", icon: PauseCircle, tone: "warning" },
];

const PRIORITY_META: Record<Priority, { icon: typeof Circle; desc: string }> = {
  baixa: { icon: Circle, desc: "Pode aguardar" },
  normal: { icon: Flag, desc: "Fluxo padrão" },
  alta: { icon: Zap, desc: "Atenção da equipe" },
  urgente: { icon: Flame, desc: "Resposta rápida" },
  critica: { icon: AlertTriangle, desc: "Bloqueia o negócio" },
};

export function CreateProjectWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [template, setTemplate] = useState<ProjectTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [status, setStatus] = useState<Project["status"]>("planejamento");
  const [ownerId, setOwnerId] = useState(users[0].id);
  const [teamIds, setTeamIds] = useState<string[]>([users[0].id]);
  const [priority, setPriority] = useState<Priority>("normal");
  const [startDate, setStartDate] = useState("2026-06-11");
  const [endDate, setEndDate] = useState("2026-07-11");

  const applyTemplate = (tpl: ProjectTemplate | null) => {
    setTemplate(tpl);
    if (tpl) {
      if (!name) setName(tpl.name);
      setColor(tpl.color);
      if (!description) setDescription(tpl.description);
      const end = new Date(startDate + "T00:00:00");
      end.setDate(end.getDate() + tpl.defaultDurationDays);
      setEndDate(end.toISOString().slice(0, 10));
    }
  };

  const prettyDate = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  const toggleMember = (id: string) => {
    setTeamIds(list => list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  };
  const selectOwner = (id: string) => {
    setOwnerId(id);
    setTeamIds(list => list.includes(id) ? list : [...list, id]);
  };

  const reset = () => {
    setStep(0); setTemplate(null); setName(""); setDescription(""); setColor(COLORS[0]);
    setStatus("planejamento"); setOwnerId(users[0].id); setTeamIds([users[0].id]);
    setPriority("normal"); setStartDate("2026-06-11"); setEndDate("2026-07-11");
  };
  const close = () => { reset(); onClose(); };

  const submit = () => {
    if (!name.trim()) return;
    const id = `p_${Date.now().toString(36)}`;
    projectsStore.addProject({
      id, name: name.trim(), description: description.trim(),
      ownerId, teamIds: teamIds.includes(ownerId) ? teamIds : [ownerId, ...teamIds],
      startDate, endDate, status, color, priority, progress: 0, health: 100,
    });
    if (template) applyTemplateToProject(template, id, startDate, ownerId);
    close();
  };

  const canNext = step === 0 ? name.trim().length > 0 : true;
  const owner = users.find(u => u.id === ownerId);
  const members = users.filter(u => teamIds.includes(u.id));
  const fmt = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  const durationDays = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-6xl w-[96vw] p-0 overflow-hidden gap-0 border-0 [&>button]:hidden h-[90vh] max-h-[860px]">
        <div className="grid grid-cols-1 md:grid-cols-[400px_1fr] h-full min-h-0">
          {/* SIDEBAR */}
          <aside
            className="relative hidden md:flex flex-col justify-between p-8 text-white overflow-hidden"
            style={{ backgroundImage: `url(${wizardBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/55 to-black/85" />
            <div
              className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-3xl opacity-40 pointer-events-none"
              style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
            />

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1.5 text-[11px] font-medium border border-white/20">
                <Sparkles className="h-3 w-3" /> Assistente de novo projeto
              </div>
              <h2 className="mt-6 text-3xl font-semibold leading-tight tracking-tight">
                Estruture iniciativas<br />
                <span className="text-white/70">do começo ao fim.</span>
              </h2>
              <p className="mt-3 text-sm text-white/70 capitalize">{prettyDate}</p>
            </div>

            <ol className="relative space-y-1.5">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const active = i === step;
                const done = i < step;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => { if (i <= step) setStep(i); }}
                      className={`relative w-full flex items-start gap-3.5 rounded-2xl p-3.5 text-left transition-all ${
                        active ? "bg-white/15 backdrop-blur border border-white/30 shadow-lg" : "hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all ${
                        done ? "bg-emerald-400 border-emerald-300 text-emerald-950"
                        : active ? "bg-white text-foreground border-white scale-110"
                        : "bg-white/10 border-white/20 text-white/70"
                      }`}>
                        {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className={`text-sm font-semibold flex items-center gap-2 ${active ? "text-white" : "text-white/90"}`}>
                          {s.title}
                          {active && <ChevronRight className="h-3.5 w-3.5 text-white/70" />}
                        </div>
                        <div className="text-[11px] text-white/60 leading-snug mt-0.5">{s.desc}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="relative space-y-2">
              <div className="flex items-center justify-between text-[11px] text-white/70">
                <span>Progresso</span>
                <span className="font-semibold text-white">{Math.round(progressPct)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-white to-white/80 transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="text-[11px] text-white/60">Passo {step + 1} de {STEPS.length}</div>
            </div>
          </aside>

          {/* CONTENT */}
          <div className="flex flex-col bg-background min-h-0 h-full">
            <div className="flex items-center justify-between px-8 pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span className="capitalize">{prettyDate}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={close}><X className="h-4 w-4" /></Button>
            </div>

            <div className="md:hidden px-8 pt-2">
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="flex-1 px-8 py-7 overflow-y-auto">
              <div key={step} className="animate-fade-in">
                {step === 0 && (
                  <div className="space-y-7">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight">Como quer começar?</h3>
                      <p className="text-sm text-muted-foreground mt-1.5">Use um template pronto para acelerar ou crie do zero.</p>
                    </div>

                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Ponto de partida</Label>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <BigCard
                          selected={!template}
                          onClick={() => applyTemplate(null)}
                          icon={<FileEdit className="h-6 w-6" />}
                          title="Projeto em branco"
                          desc="Comece do zero, sem tarefas pré-definidas."
                          badge="Customizado"
                        />
                        {projectTemplates.map(t => {
                          const sel = template?.id === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => applyTemplate(t)}
                              className={`group text-left rounded-2xl border-2 p-4 transition-all relative overflow-hidden ${
                                sel ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                                : "border-border hover:border-primary/40 hover:shadow-sm"
                              }`}
                              style={!sel ? { background: `linear-gradient(135deg, color-mix(in oklab, ${t.color} 10%, transparent), transparent)` } : {}}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span
                                  className="h-11 w-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
                                  style={{ backgroundColor: `color-mix(in oklab, ${t.color} 20%, transparent)` }}
                                >
                                  {t.icon}
                                </span>
                                {sel && <CheckCircle2 className="h-5 w-5 text-primary" />}
                              </div>
                              <div className="mt-3 font-semibold text-sm leading-tight">{t.name}</div>
                              <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{t.description}</div>
                              <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{t.tasks.length} tarefas</span>
                                <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{t.defaultDurationDays}d</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {template && (
                        <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary bg-primary/10 rounded-full px-3 py-1.5">
                          <Sparkles className="h-3.5 w-3.5" /> {template.tasks.length} tarefas serão criadas automaticamente
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 items-end">
                      <div>
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Nome do projeto</Label>
                        <Input
                          autoFocus value={name} onChange={(e) => setName(e.target.value)}
                          placeholder="Ex.: Expansão Unidade Campinas"
                          className="mt-2 h-14 text-lg font-medium"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                          <Palette className="h-3.5 w-3.5" /> Cor
                        </Label>
                        <div className="mt-2 grid grid-cols-8 lg:grid-cols-4 gap-2">
                          {COLORS.map(c => (
                            <button
                              key={c} type="button" onClick={() => setColor(c)}
                              className={`h-10 w-10 rounded-xl transition-all relative ${color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"}`}
                              style={{ backgroundColor: c }}
                            >
                              {color === c && <CheckCircle2 className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-gradient-to-br from-muted/40 to-transparent p-4 flex items-center gap-4">
                      <span className="h-14 w-14 rounded-xl shrink-0 shadow-lg" style={{ backgroundColor: color }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-semibold truncate">{name || "Nome do projeto"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Pré-visualização do cartão do projeto</div>
                      </div>
                      <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-7">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight">Sobre o que se trata?</h3>
                      <p className="text-sm text-muted-foreground mt-1.5">Descreva o objetivo e selecione o status inicial.</p>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Descrição</Label>
                      <Textarea
                        value={description} onChange={(e) => setDescription(e.target.value)}
                        placeholder="Objetivo, escopo, entregas esperadas, contexto relevante..."
                        className="mt-2 min-h-36 text-base resize-none"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Status inicial</Label>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                        {STATUS_OPTIONS.map(s => {
                          const Icon = s.icon;
                          const sel = status === s.id;
                          return (
                            <button
                              key={s.id} type="button" onClick={() => setStatus(s.id)}
                              className={`group text-left rounded-2xl border-2 p-5 transition-all relative ${
                                sel ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20" : "border-border hover:border-primary/40 hover:shadow-sm"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`h-11 w-11 rounded-xl flex items-center justify-center bg-${s.tone}/15 text-${s.tone}`}>
                                  <Icon className="h-5 w-5" />
                                </span>
                                {sel && <CheckCircle2 className="h-5 w-5 text-primary" />}
                              </div>
                              <div className="mt-3 font-semibold">{s.label}</div>
                              <div className="text-xs text-muted-foreground mt-1 leading-snug">{s.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-7">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight">Quem participa?</h3>
                      <p className="text-sm text-muted-foreground mt-1.5">Defina o responsável e monte a equipe do projeto.</p>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                        <Crown className="h-3.5 w-3.5" /> Responsável (Owner)
                      </Label>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                        {users.map(u => {
                          const sel = ownerId === u.id;
                          return (
                            <button
                              key={u.id} type="button" onClick={() => selectOwner(u.id)}
                              className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                                sel ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                              }`}
                            >
                              <span className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0" style={{ backgroundColor: u.color }}>
                                {u.initials}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold truncate">{u.name}</div>
                                <div className="text-[11px] text-muted-foreground truncate">{u.role} · {u.department}</div>
                              </div>
                              {sel && <Crown className="h-4 w-4 text-warning shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Equipe ({teamIds.length} membros)</Label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {users.map(u => {
                          const selected = teamIds.includes(u.id);
                          const isOwner = u.id === ownerId;
                          return (
                            <button
                              key={u.id} type="button" disabled={isOwner}
                              onClick={() => toggleMember(u.id)}
                              className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-2 text-xs transition-all ${
                                selected ? "border-primary bg-primary/10 text-foreground font-medium" : "border-border text-muted-foreground hover:border-primary/50"
                              } ${isOwner ? "cursor-not-allowed" : ""}`}
                            >
                              <span className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold" style={{ backgroundColor: u.color }}>{u.initials}</span>
                              {u.name.split(" ")[0]}
                              {isOwner && <Crown className="h-3 w-3 text-warning" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-7">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight">Prazos e urgência</h3>
                      <p className="text-sm text-muted-foreground mt-1.5">Defina o período de execução e o nível de prioridade.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-2xl border-2 border-border p-5 bg-gradient-to-br from-muted/30 to-transparent">
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Data de início</Label>
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-2 h-12 text-base" />
                      </div>
                      <div className="rounded-2xl border-2 border-border p-5 bg-gradient-to-br from-muted/30 to-transparent">
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Data de término</Label>
                        <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="mt-2 h-12 text-base" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      Duração estimada: <span className="font-semibold text-foreground">{durationDays} dias</span>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Prioridade</Label>
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2.5">
                        {(["baixa","normal","alta","urgente","critica"] as Priority[]).map(p => {
                          const Icon = PRIORITY_META[p].icon;
                          const sel = priority === p;
                          return (
                            <button
                              key={p} type="button" onClick={() => setPriority(p)}
                              className={`group rounded-2xl border-2 p-4 text-center transition-all ${
                                sel ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20 scale-105" : "border-border hover:border-primary/40 hover:shadow-sm"
                              }`}
                            >
                              <div className="flex justify-center">
                                <span className={`h-10 w-10 rounded-xl flex items-center justify-center ${priorityMeta[p].className}`}>
                                  <Icon className="h-5 w-5" />
                                </span>
                              </div>
                              <div className="mt-2.5 text-sm font-semibold">{priorityMeta[p].label}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{PRIORITY_META[p].desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight">Tudo certo?</h3>
                      <p className="text-sm text-muted-foreground mt-1.5">Revise as informações antes de criar o projeto.</p>
                    </div>
                    <div className="rounded-2xl border-2 bg-gradient-to-br from-muted/30 to-transparent overflow-hidden">
                      <div className="h-2" style={{ backgroundColor: color }} />
                      <div className="p-6 space-y-5">
                        <div className="flex items-start gap-4">
                          <span className="h-14 w-14 rounded-xl shrink-0 shadow-md" style={{ backgroundColor: color }} />
                          <div className="min-w-0 flex-1">
                            <div className="text-xl font-semibold truncate">{name || "Sem nome"}</div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="secondary">{STATUS_OPTIONS.find(s => s.id === status)?.label}</Badge>
                              <span className={`text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 ${priorityMeta[priority].className}`}>{priorityMeta[priority].label}</span>
                              {template && <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> {template.name}</Badge>}
                            </div>
                            {description && <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{description}</p>}
                          </div>
                        </div>
                        <div className="h-px bg-border" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
                          <Field label="Responsável">
                            <div className="flex items-center gap-2">
                              <span className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold" style={{ backgroundColor: owner?.color }}>{owner?.initials}</span>
                              <span className="font-medium">{owner?.name}</span>
                            </div>
                          </Field>
                          <Field label="Período"><span className="font-medium">{fmt(startDate)} → {fmt(endDate)} <span className="text-muted-foreground">({durationDays}d)</span></span></Field>
                        </div>
                        <div className="h-px bg-border" />
                        <Field label={`Equipe (${members.length} membros)`}>
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {members.map(u => (
                              <span key={u.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1.5 text-xs">
                                <span className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[9px] font-semibold" style={{ backgroundColor: u.color }}>{u.initials}</span>
                                {u.name.split(" ")[0]}
                                {u.id === ownerId && <Crown className="h-3 w-3 text-warning" />}
                              </span>
                            ))}
                          </div>
                        </Field>
                        {template && (
                          <>
                            <div className="h-px bg-border" />
                            <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 rounded-lg p-3">
                              <Sparkles className="h-4 w-4" />
                              <span>{template.tasks.length} tarefas serão criadas automaticamente a partir do template <strong>{template.name}</strong>.</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* FOOTER */}
            <div className="flex items-center justify-between border-t px-8 py-5 bg-muted/30">
              <Button variant="ghost" size="lg" onClick={step === 0 ? close : () => setStep(s => s - 1)}>
                {step === 0 ? "Cancelar" : (<><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</>)}
              </Button>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-1">
                  {STEPS.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-primary" : i < step ? "w-4 bg-primary/50" : "w-4 bg-muted-foreground/20"}`}
                    />
                  ))}
                </div>
                {step < STEPS.length - 1 ? (
                  <Button size="lg" onClick={() => setStep(s => s + 1)} disabled={!canNext}>
                    Continuar <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button size="lg" onClick={submit} disabled={!name.trim()}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Criar projeto
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BigCard({ selected, onClick, icon, title, desc, badge }: { selected: boolean; onClick: () => void; icon: ReactNode; title: string; desc: string; badge?: string }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`text-left rounded-2xl border-2 border-dashed p-4 transition-all ${
        selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="h-11 w-11 rounded-xl flex items-center justify-center bg-muted text-muted-foreground">{icon}</span>
        {selected && <CheckCircle2 className="h-5 w-5 text-primary" />}
      </div>
      <div className="mt-3 font-semibold text-sm">{title}</div>
      <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{desc}</div>
      {badge && <div className="mt-3 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{badge}</div>}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">{label}</div>
      <div>{children}</div>
    </div>
  );
}
