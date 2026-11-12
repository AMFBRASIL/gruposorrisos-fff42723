import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  CalendarDays, Sparkles, Target, Building2, CheckCircle2,
  ArrowRight, ArrowLeft, X, TrendingUp,
} from "lucide-react";
import { dealsStore, useClients } from "@/lib/store";
import { users, formatBRL, DEAL_STAGES, type Deal, type DealStage } from "@/lib/mock-data";
import wizardBg from "@/assets/wizard-bg.jpg";

const STEPS = [
  { id: 0, title: "Oportunidade", desc: "Título e cliente", icon: Target },
  { id: 1, title: "Valor & Etapa", desc: "Pipeline e probabilidade", icon: TrendingUp },
  { id: 2, title: "Origem & Prazo", desc: "Fonte e fechamento", icon: Building2 },
  { id: 3, title: "Revisão", desc: "Confirme e crie", icon: CheckCircle2 },
];

const SOURCES = ["Indicação", "Inbound", "Outbound", "Evento", "Parceiro", "Licitação", "Base atual", "Outros"];

const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;
const defaultProb: Record<DealStage, number> = {
  lead: 10, qualificacao: 25, proposta: 50, negociacao: 75, ganho: 100, perdido: 0,
};

export function CreateDealWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const clients = useClients();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [ownerId, setOwnerId] = useState(users[0]?.id || "");
  const [value, setValue] = useState<number | "">("");
  const [stage, setStage] = useState<DealStage>("lead");
  const [probability, setProbability] = useState(10);
  const [source, setSource] = useState(SOURCES[0]);
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(0); setTitle(""); setClientId(clients[0]?.id || ""); setOwnerId(users[0]?.id || "");
    setValue(""); setStage("lead"); setProbability(10); setSource(SOURCES[0]);
    setExpectedCloseDate(""); setNotes("");
  }, [open]);

  const pickStage = (s: DealStage) => { setStage(s); setProbability(defaultProb[s]); };

  const canNext =
    step === 0 ? title.trim().length > 0 && !!clientId :
    step === 1 ? typeof value === "number" && value > 0 :
    true;

  const submit = () => {
    if (!title.trim() || !clientId) return;
    const deal: Deal = {
      id: uid("deal"),
      title: title.trim(),
      clientId,
      ownerId,
      value: typeof value === "number" ? value : 0,
      stage,
      probability,
      expectedCloseDate: expectedCloseDate || todayISO(),
      source,
      createdAt: todayISO(),
      notes: notes.trim() || undefined,
    };
    dealsStore.addDeal(deal);
    onClose();
  };

  const prettyDate = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const stageMeta = DEAL_STAGES.find(s => s.id === stage)!;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0 border-0 [&>button]:hidden">
        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] min-h-[640px] max-h-[90vh]">
          <aside
            className="relative hidden md:flex flex-col justify-between p-7 text-white overflow-hidden"
            style={{ backgroundImage: `url(${wizardBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-black/55 via-black/40 to-black/70" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-[11px] font-medium border border-white/20">
                <Sparkles className="h-3 w-3" /> Nova oportunidade
              </div>
              <h2 className="mt-5 text-2xl font-semibold leading-tight">Pipeline previsível,<br />receita previsível.</h2>
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

          <div className="flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-7 pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" /><span className="capitalize">{prettyDate}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>

            <div className="flex-1 px-7 py-6 overflow-y-auto">
              {step === 0 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-semibold">A oportunidade</h3>
                    <p className="text-sm text-muted-foreground mt-1">Descreva o negócio e escolha o cliente.</p>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Título</Label>
                    <Input autoFocus value={title} onChange={e => setTitle(e.target.value)}
                      placeholder="Ex.: Implantação de ERP — Fase 1" className="mt-2 h-12 text-base" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</Label>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
                      {clients.map(c => (
                        <button key={c.id} type="button" onClick={() => setClientId(c.id)}
                          className={`rounded-xl border p-3 text-left transition-all flex items-center gap-3 ${clientId === c.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"}`}>
                          <span className="h-10 w-10 rounded-lg flex items-center justify-center text-xs font-semibold text-white shrink-0"
                            style={{ backgroundColor: c.color }}>{c.logo}</span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{c.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{c.segment} · {c.city}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-semibold">Valor & etapa</h3>
                    <p className="text-sm text-muted-foreground mt-1">Defina o ticket e onde o negócio entra no funil.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Valor (R$)</Label>
                      <CurrencyInput autoFocus aria-label="Valor (R$)" value={value} onValueChange={setValue} className="mt-2 h-12 text-base" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Responsável</Label>
                      <select value={ownerId} onChange={e => setOwnerId(e.target.value)}
                        className="mt-2 h-12 w-full rounded-md border border-input bg-background px-3 text-sm">
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Etapa do pipeline</Label>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                      {DEAL_STAGES.map(s => (
                        <button key={s.id} type="button" onClick={() => pickStage(s.id)}
                          className={`rounded-xl border p-3 text-left transition-all ${stage === s.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"}`}>
                          <span className="inline-block h-1.5 w-8 rounded-full mb-2" style={{ backgroundColor: s.color }} />
                          <div className="text-sm font-medium">{s.title}</div>
                          <div className="text-[10px] text-muted-foreground">{defaultProb[s.id]}% padrão</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Probabilidade — {probability}%
                    </Label>
                    <input type="range" min={0} max={100} step={5} value={probability}
                      onChange={e => setProbability(Number(e.target.value))}
                      className="mt-3 w-full accent-primary" />
                    <div className="text-xs text-muted-foreground mt-2">
                      Valor ponderado: <span className="font-medium text-foreground">
                        {formatBRL((typeof value === "number" ? value : 0) * (probability / 100))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-semibold">Origem & prazo</h3>
                    <p className="text-sm text-muted-foreground mt-1">De onde veio e quando deve fechar.</p>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Origem</Label>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                      {SOURCES.map(s => (
                        <button key={s} type="button" onClick={() => setSource(s)}
                          className={`rounded-lg border px-3 py-2.5 text-sm transition-all ${source === s ? "border-primary bg-primary/5 ring-1 ring-primary font-medium" : "border-border hover:border-primary/40"}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Fechamento previsto</Label>
                    <Input type="date" value={expectedCloseDate} onChange={e => setExpectedCloseDate(e.target.value)} className="mt-2 h-11 md:max-w-xs" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notas</Label>
                    <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5}
                      placeholder="Contexto, concorrentes, próximos passos..." className="mt-2 resize-none" />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-semibold">Tudo certo?</h3>
                    <p className="text-sm text-muted-foreground mt-1">Revise antes de criar a oportunidade.</p>
                  </div>
                  <div className="rounded-xl border bg-card/40 p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: stageMeta.color + "22", color: stageMeta.color }}>
                        <Target className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-base font-semibold">{title || "Sem título"}</div>
                        <div className="text-xs text-muted-foreground">
                          {clients.find(c => c.id === clientId)?.name || "—"} · {stageMeta.title}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <Field label="Valor" value={formatBRL(typeof value === "number" ? value : 0)} />
                      <Field label="Probabilidade" value={`${probability}%`} />
                      <Field label="Ponderado" value={formatBRL((typeof value === "number" ? value : 0) * (probability / 100))} />
                      <Field label="Responsável" value={users.find(u => u.id === ownerId)?.name || "—"} />
                      <Field label="Origem" value={source} />
                      <Field label="Fechamento" value={expectedCloseDate || "—"} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t px-7 py-4 bg-muted/30">
              <Button variant="ghost" onClick={() => step === 0 ? onClose() : setStep(s => s - 1)}>
                <ArrowLeft className="h-4 w-4" /> {step === 0 ? "Cancelar" : "Voltar"}
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep(s => s + 1)} disabled={!canNext}>
                  Continuar <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={submit} disabled={!title.trim() || !clientId}>
                  <CheckCircle2 className="h-4 w-4" /> Criar oportunidade
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
