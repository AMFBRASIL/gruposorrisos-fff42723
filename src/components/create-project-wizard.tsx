import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays, FolderKanban, Users as UsersIcon, FileText, Flag, CheckCircle2,
  Sparkles, ArrowRight, ArrowLeft, X, Palette, Crown,
} from "lucide-react";
import { users, priorityMeta, type Priority, type Project } from "@/lib/mock-data";
import { projectsStore } from "@/lib/store";
import wizardBg from "@/assets/wizard-bg.jpg";

const STEPS = [
  { id: 0, title: "Identidade", desc: "Nome e cor do projeto", icon: FolderKanban },
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

const STATUS_OPTIONS: { id: Project["status"]; label: string; desc: string }[] = [
  { id: "planejamento", label: "Planejamento", desc: "Definindo escopo e equipe" },
  { id: "andamento", label: "Em andamento", desc: "Execução já iniciada" },
  { id: "pausado", label: "Pausado", desc: "Temporariamente parado" },
];

export function CreateProjectWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [status, setStatus] = useState<Project["status"]>("planejamento");
  const [ownerId, setOwnerId] = useState(users[0].id);
  const [teamIds, setTeamIds] = useState<string[]>([users[0].id]);
  const [priority, setPriority] = useState<Priority>("normal");
  const [startDate, setStartDate] = useState("2026-06-11");
  const [endDate, setEndDate] = useState("2026-07-11");

  const prettyDate = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  const toggleMember = (id: string) => {
    setTeamIds(list => list.includes(id) ? list.filter(x => x !== id && x !== "") : [...list, id]);
  };

  const selectOwner = (id: string) => {
    setOwnerId(id);
    setTeamIds(list => list.includes(id) ? list : [...list, id]);
  };

  const reset = () => {
    setStep(0); setName(""); setDescription(""); setColor(COLORS[0]);
    setStatus("planejamento"); setOwnerId(users[0].id); setTeamIds([users[0].id]);
    setPriority("normal"); setStartDate("2026-06-11"); setEndDate("2026-07-11");
  };

  const close = () => { reset(); onClose(); };

  const submit = () => {
    if (!name.trim()) return;
    projectsStore.addProject({
      id: `p_${Date.now().toString(36)}`,
      name: name.trim(),
      description: description.trim(),
      ownerId,
      teamIds: teamIds.includes(ownerId) ? teamIds : [ownerId, ...teamIds],
      startDate, endDate, status, color, priority,
      progress: 0, health: 100,
    });
    close();
  };

  const canNext = step === 0 ? name.trim().length > 0 : true;
  const owner = users.find(u => u.id === ownerId);
  const members = users.filter(u => teamIds.includes(u.id));
  const fmt = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

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
                <Sparkles className="h-3 w-3" /> Novo projeto
              </div>
              <h2 className="mt-5 text-2xl font-semibold leading-tight">
                Estruture iniciativas<br />do começo ao fim.
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
                      <h3 className="text-xl font-semibold">Qual é o projeto?</h3>
                      <p className="text-sm text-muted-foreground mt-1">Dê um nome claro e escolha a cor de identificação.</p>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nome do projeto</Label>
                      <Input
                        autoFocus value={name} onChange={(e) => setName(e.target.value)}
                        placeholder="Ex.: Expansão Unidade Campinas"
                        className="mt-2 h-12 text-base"
                      />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <Palette className="h-3.5 w-3.5" /> Cor de identificação
                      </Label>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {COLORS.map(c => (
                          <button
                            key={c} type="button" onClick={() => setColor(c)}
                            aria-label={`Cor ${c}`}
                            className={`h-10 w-10 rounded-xl transition-all ${color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-card/40 p-4 flex items-center gap-3">
                      <span className="h-10 w-10 rounded-lg shrink-0" style={{ backgroundColor: color }} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{name || "Nome do projeto"}</div>
                        <div className="text-[11px] text-muted-foreground">Pré-visualização do cartão</div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-semibold">Sobre o que se trata?</h3>
                      <p className="text-sm text-muted-foreground mt-1">Descreva o objetivo e defina o status inicial.</p>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Descrição</Label>
                      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Objetivo, escopo, entregas esperadas..." className="mt-2 min-h-28" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status inicial</Label>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {STATUS_OPTIONS.map(s => (
                          <button
                            key={s.id} type="button" onClick={() => setStatus(s.id)}
                            className={`rounded-lg border p-3 text-left transition-all ${
                              status === s.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className="text-sm font-medium">{s.label}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">{s.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-semibold">Quem participa?</h3>
                      <p className="text-sm text-muted-foreground mt-1">Escolha o responsável e monte a equipe do projeto.</p>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <Crown className="h-3.5 w-3.5" /> Responsável
                      </Label>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                        {users.map(u => (
                          <button
                            key={u.id} type="button" onClick={() => selectOwner(u.id)}
                            className={`flex items-center gap-3 rounded-lg border p-2.5 text-left transition-all ${
                              ownerId === u.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"
                            }`}
                          >
                            <span className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0" style={{ backgroundColor: u.color }}>
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
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Equipe ({teamIds.length})</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {users.map(u => {
                          const selected = teamIds.includes(u.id);
                          const isOwner = u.id === ownerId;
                          return (
                            <button
                              key={u.id} type="button" disabled={isOwner}
                              onClick={() => toggleMember(u.id)}
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all ${
                                selected ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/50"
                              } ${isOwner ? "opacity-100" : ""}`}
                            >
                              <span className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[9px] font-semibold" style={{ backgroundColor: u.color }}>{u.initials}</span>
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
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold">Prazos e urgência</h3>
                      <p className="text-sm text-muted-foreground mt-1">Defina o período de execução e a prioridade.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Data de início</Label>
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-2 h-11" />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Data de término</Label>
                        <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="mt-2 h-11" />
                      </div>
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
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-semibold">Tudo certo?</h3>
                      <p className="text-sm text-muted-foreground mt-1">Revise as informações antes de criar o projeto.</p>
                    </div>
                    <div className="rounded-xl border bg-card/40 p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <span className="h-10 w-10 rounded-lg shrink-0" style={{ backgroundColor: color }} />
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-semibold truncate">{name || "Sem nome"}</div>
                          <div className="text-xs text-muted-foreground">{STATUS_OPTIONS.find(s => s.id === status)?.label}</div>
                          {description && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{description}</p>}
                        </div>
                      </div>
                      <div className="h-px bg-border" />
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <Field label="Responsável">
                          <div className="flex items-center gap-2">
                            <span className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold" style={{ backgroundColor: owner?.color }}>{owner?.initials}</span>
                            <span>{owner?.name}</span>
                          </div>
                        </Field>
                        <Field label="Status"><Badge variant="secondary">{STATUS_OPTIONS.find(s => s.id === status)?.label}</Badge></Field>
                        <Field label="Prioridade"><span className={`text-xs font-semibold uppercase rounded px-1.5 py-0.5 ${priorityMeta[priority].className}`}>{priorityMeta[priority].label}</span></Field>
                        <Field label="Período"><span>{fmt(startDate)} → {fmt(endDate)}</span></Field>
                      </div>
                      <div className="h-px bg-border" />
                      <Field label={`Equipe (${members.length})`}>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {members.map(u => (
                            <span key={u.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs">
                              <span className="h-4 w-4 rounded-full flex items-center justify-center text-white text-[8px] font-semibold" style={{ backgroundColor: u.color }}>{u.initials}</span>
                              {u.name.split(" ")[0]}
                              {u.id === ownerId && <Crown className="h-3 w-3 text-warning" />}
                            </span>
                          ))}
                        </div>
                      </Field>
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
                <Button onClick={submit} disabled={!name.trim()}>
                  <CheckCircle2 className="h-4 w-4" /> Criar projeto
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
