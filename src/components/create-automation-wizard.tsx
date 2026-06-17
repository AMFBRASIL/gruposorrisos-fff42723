import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CalendarDays, Zap, Sparkles, CheckCircle2, ArrowRight, ArrowLeft, X, AlertTriangle, Clock, Plus, GitBranch, Bell, Mail, ListChecks } from "lucide-react";
import { automationsStore } from "@/lib/store";
import type { TriggerType, ActionType, AutomationRule } from "@/lib/mock-data";
import wizardBg from "@/assets/wizard-bg.jpg";

const STEPS = [
  { id: 0, title: "Gatilho", desc: "Quando deve executar", icon: Zap },
  { id: 1, title: "Configuração", desc: "Parâmetros do gatilho", icon: ListChecks },
  { id: 2, title: "Ações", desc: "O que fazer", icon: ArrowRight },
  { id: 3, title: "Identidade", desc: "Nome e descrição", icon: Sparkles },
  { id: 4, title: "Revisão", desc: "Confirme e ative", icon: CheckCircle2 },
];

const TRIGGERS: { id: TriggerType; label: string; desc: string; icon: any; color: string }[] = [
  { id: "status_change", label: "Mudança de status", desc: "Quando uma tarefa muda de coluna", icon: ArrowRight, color: "oklch(0.65 0.14 230)" },
  { id: "task_created", label: "Tarefa criada", desc: "Toda vez que uma nova tarefa é criada", icon: Plus, color: "oklch(0.62 0.16 155)" },
  { id: "due_soon", label: "Prazo próximo", desc: "Quando o vencimento está próximo", icon: Clock, color: "oklch(0.7 0.15 70)" },
  { id: "overdue", label: "Tarefa atrasada", desc: "Quando passa do prazo", icon: AlertTriangle, color: "oklch(0.65 0.18 25)" },
  { id: "assigned", label: "Atribuição", desc: "Quando alguém é responsabilizado", icon: GitBranch, color: "oklch(0.6 0.2 295)" },
];

const ACTIONS: { id: ActionType; label: string; desc: string; icon: any }[] = [
  { id: "notify", label: "Notificar pessoa", desc: "Envia notificação in-app", icon: Bell },
  { id: "send_email", label: "Enviar e-mail", desc: "Dispara e-mail automático", icon: Mail },
  { id: "create_task", label: "Criar tarefa", desc: "Cria uma nova tarefa relacionada", icon: Plus },
  { id: "move_status", label: "Mover status", desc: "Move para outra coluna", icon: ArrowRight },
  { id: "set_priority", label: "Alterar prioridade", desc: "Atualiza a prioridade", icon: Zap },
];

const COLORS = ["oklch(0.65 0.18 25)", "oklch(0.62 0.16 155)", "oklch(0.7 0.15 70)", "oklch(0.65 0.14 230)", "oklch(0.6 0.2 295)", "oklch(0.7 0.18 340)"];

export function CreateAutomationWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [trigger, setTrigger] = useState<TriggerType>("overdue");
  const [config, setConfig] = useState<Record<string, string>>({ days: "0" });
  const [selectedActions, setSelectedActions] = useState<ActionType[]>(["notify"]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const reset = () => {
    setStep(0); setTrigger("overdue"); setConfig({ days: "0" });
    setSelectedActions(["notify"]); setName(""); setDescription("");
  };
  const close = () => { reset(); onClose(); };

  const toggleAction = (id: ActionType) => {
    setSelectedActions(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);
  };

  const submit = () => {
    if (!name.trim() || selectedActions.length === 0) return;
    const rule: AutomationRule = {
      id: `auto_${Date.now().toString(36)}`,
      name: name.trim(), description: description.trim(), enabled: true,
      trigger, triggerConfig: config, conditions: [],
      actions: selectedActions.map(t => ({ type: t, payload: {} })),
      runs: 0, createdAt: new Date().toISOString().slice(0, 10),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
    automationsStore.addRule(rule);
    close();
  };

  const canNext =
    step === 0 ? !!trigger :
    step === 2 ? selectedActions.length > 0 :
    step === 3 ? name.trim().length > 0 : true;

  const prettyDate = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const triggerMeta = TRIGGERS.find(t => t.id === trigger)!;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0 border-0 [&>button]:hidden">
        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] min-h-[620px]">
          <aside
            className="relative hidden md:flex flex-col justify-between p-7 text-white overflow-hidden"
            style={{ backgroundImage: `url(${wizardBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-black/55 via-black/40 to-black/70" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-[11px] font-medium border border-white/20">
                <Sparkles className="h-3 w-3" /> Nova automação
              </div>
              <h2 className="mt-5 text-2xl font-semibold leading-tight">Reduza trabalho<br />repetitivo.</h2>
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
                  <div><h3 className="text-xl font-semibold">Quando essa regra deve executar?</h3><p className="text-sm text-muted-foreground mt-1">Escolha o gatilho que dispara a automação.</p></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {TRIGGERS.map(t => {
                      const TIcon = t.icon; const sel = trigger === t.id;
                      return (
                        <button key={t.id} type="button" onClick={() => setTrigger(t.id)}
                          className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${sel ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"}`}>
                          <span className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `color-mix(in oklab, ${t.color} 18%, transparent)`, color: t.color }}>
                            <TIcon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium leading-tight">{t.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div><h3 className="text-xl font-semibold">Configuração do gatilho</h3><p className="text-sm text-muted-foreground mt-1">{triggerMeta.label}</p></div>
                  {(trigger === "due_soon" || trigger === "overdue") && (
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Dias {trigger === "due_soon" ? "antes do prazo" : "após o vencimento"}</Label>
                      <Input type="number" min={0} value={config.days || "0"} onChange={e => setConfig({ ...config, days: e.target.value })} className="mt-2 h-11 w-32" />
                    </div>
                  )}
                  {trigger === "status_change" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">De (status)</Label>
                        <Input value={config.from || ""} onChange={e => setConfig({ ...config, from: e.target.value })} placeholder="qualquer" className="mt-2 h-11" />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Para (status)</Label>
                        <Input value={config.to || ""} onChange={e => setConfig({ ...config, to: e.target.value })} placeholder="qualquer" className="mt-2 h-11" />
                      </div>
                    </div>
                  )}
                  {(trigger === "task_created" || trigger === "assigned") && (
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      Esse gatilho não precisa de configuração extra.
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div><h3 className="text-xl font-semibold">O que deve acontecer?</h3><p className="text-sm text-muted-foreground mt-1">Selecione uma ou mais ações.</p></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ACTIONS.map(a => {
                      const AIcon = a.icon; const sel = selectedActions.includes(a.id);
                      return (
                        <button key={a.id} type="button" onClick={() => toggleAction(a.id)}
                          className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${sel ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"}`}>
                          <span className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${sel ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                            <AIcon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium leading-tight">{a.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{a.desc}</div>
                          </div>
                          {sel && <CheckCircle2 className="h-4 w-4 text-primary shrink-0 ml-auto" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div><h3 className="text-xl font-semibold">Dê um nome à regra</h3><p className="text-sm text-muted-foreground mt-1">Para facilitar identificá-la depois.</p></div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nome</Label>
                    <Input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Notificar gestor em tarefas atrasadas" className="mt-2 h-12 text-base" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Descrição</Label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Explique o que essa automação faz..." className="mt-2 min-h-24" />
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-5">
                  <div><h3 className="text-xl font-semibold">Revise sua automação</h3><p className="text-sm text-muted-foreground mt-1">Será ativada assim que você salvar.</p></div>
                  <div className="rounded-xl border bg-card/40 p-5 space-y-4">
                    <div className="text-base font-semibold">{name || "Sem nome"}</div>
                    {description && <p className="text-sm text-muted-foreground">{description}</p>}
                    <div className="h-px bg-border" />
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Quando</span>
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium">
                        <triggerMeta.icon className="h-3 w-3" /> {triggerMeta.label}
                      </span>
                      {Object.entries(config).filter(([_, v]) => v).map(([k, v]) => (
                        <span key={k} className="text-xs text-muted-foreground">· {k}: {v}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Então</span>
                      {selectedActions.map(a => {
                        const ad = ACTIONS.find(x => x.id === a)!; const Ai = ad.icon;
                        return (
                          <span key={a} className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 text-primary px-2 py-1 text-xs font-medium">
                            <Ai className="h-3 w-3" /> {ad.label}
                          </span>
                        );
                      })}
                    </div>
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
                <Button onClick={submit} disabled={!name.trim() || selectedActions.length === 0}>
                  <CheckCircle2 className="h-4 w-4" /> Criar e ativar
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
