import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  CalendarDays, Sparkles, Building2, Users, CheckCircle2,
  ArrowRight, ArrowLeft, X, TrendingUp,
} from "lucide-react";
import { clientsStore } from "@/lib/store";
import { users, formatBRL, type Client } from "@/lib/mock-data";
import wizardBg from "@/assets/wizard-bg.jpg";

const STEPS = [
  { id: 0, title: "Identidade", desc: "Empresa e segmento", icon: Building2 },
  { id: 1, title: "Contato", desc: "Quem fala com você", icon: Users },
  { id: 2, title: "Relacionamento", desc: "Status e responsável", icon: TrendingUp },
  { id: 3, title: "Revisão", desc: "Confirme e crie", icon: CheckCircle2 },
];

const SEGMENTS = ["Tecnologia", "Varejo", "Saúde", "Educação", "Indústria", "Serviços", "Financeiro", "Outros"];
const STATUSES: { id: Client["status"]; label: string; desc: string }[] = [
  { id: "prospect", label: "Prospect", desc: "Em prospecção comercial" },
  { id: "ativo", label: "Ativo", desc: "Cliente em operação" },
  { id: "inativo", label: "Inativo", desc: "Sem contratos ativos" },
];
const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#10b981", "#14b8a6", "#eab308", "#ef4444"];

const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;
const initials = (n: string) =>
  n.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "CL";

export function CreateClientWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [segment, setSegment] = useState(SEGMENTS[0]);
  const [city, setCity] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [status, setStatus] = useState<Client["status"]>("prospect");
  const [ownerId, setOwnerId] = useState(users[0]?.id || "");
  const [ltv, setLtv] = useState<number | "">("");

  useEffect(() => {
    if (!open) return;
    setStep(0); setName(""); setSegment(SEGMENTS[0]); setCity(""); setColor(COLORS[0]);
    setContactName(""); setContactEmail(""); setContactPhone("");
    setStatus("prospect"); setOwnerId(users[0]?.id || ""); setLtv("");
  }, [open]);

  const canNext =
    step === 0 ? name.trim().length > 0 :
    step === 1 ? contactName.trim().length > 0 :
    true;

  const submit = () => {
    if (!name.trim()) return;
    const client: Client = {
      id: uid("cli"),
      name: name.trim(),
      segment,
      city: city.trim() || "—",
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim(),
      logo: initials(name),
      color,
      status,
      since: todayISO(),
      ltv: typeof ltv === "number" ? ltv : 0,
      ownerId,
    };
    clientsStore.addClient(client);
    onClose();
  };

  const prettyDate = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

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
                <Sparkles className="h-3 w-3" /> Novo cliente
              </div>
              <h2 className="mt-5 text-2xl font-semibold leading-tight">Relacionamento<br />começa com dados.</h2>
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
                    <h3 className="text-xl font-semibold">Identidade do cliente</h3>
                    <p className="text-sm text-muted-foreground mt-1">Nome da empresa, segmento e identidade visual.</p>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nome da empresa</Label>
                    <Input autoFocus value={name} onChange={e => setName(e.target.value)}
                      placeholder="Ex.: Acme Indústria S.A." className="mt-2 h-12 text-base" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Segmento</Label>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                      {SEGMENTS.map(s => (
                        <button key={s} type="button" onClick={() => setSegment(s)}
                          className={`rounded-lg border px-3 py-2.5 text-sm transition-all ${segment === s ? "border-primary bg-primary/5 ring-1 ring-primary font-medium" : "border-border hover:border-primary/40"}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cidade</Label>
                      <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Ex.: São Paulo — SP" className="mt-2 h-11" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cor de identificação</Label>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex flex-wrap gap-2">
                          {COLORS.map(c => (
                            <button key={c} type="button" onClick={() => setColor(c)}
                              className={`h-8 w-8 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                              style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <div className="h-11 w-11 rounded-lg flex items-center justify-center text-sm font-semibold text-white shrink-0"
                          style={{ backgroundColor: color }}>{initials(name)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-semibold">Contato principal</h3>
                    <p className="text-sm text-muted-foreground mt-1">Quem é a ponte com este cliente.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nome do contato</Label>
                      <Input autoFocus value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Ex.: Maria Souza" className="mt-2 h-11" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">E-mail</Label>
                      <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="contato@empresa.com" className="mt-2 h-11" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Telefone</Label>
                      <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="(11) 90000-0000" className="mt-2 h-11" />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-semibold">Relacionamento</h3>
                    <p className="text-sm text-muted-foreground mt-1">Status atual, responsável interno e valor histórico.</p>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                      {STATUSES.map(s => (
                        <button key={s.id} type="button" onClick={() => setStatus(s.id)}
                          className={`rounded-xl border p-4 text-left transition-all ${status === s.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"}`}>
                          <div className="text-sm font-medium">{s.label}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{s.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Responsável</Label>
                      <select value={ownerId} onChange={e => setOwnerId(e.target.value)}
                        className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">LTV inicial (R$)</Label>
                      <CurrencyInput aria-label="LTV inicial (R$)" value={ltv} onValueChange={setLtv} className="mt-2 h-11" />
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-semibold">Tudo certo?</h3>
                    <p className="text-sm text-muted-foreground mt-1">Revise antes de cadastrar o cliente.</p>
                  </div>
                  <div className="rounded-xl border bg-card/40 p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="h-12 w-12 rounded-lg flex items-center justify-center text-base font-semibold text-white shrink-0"
                        style={{ backgroundColor: color }}>{initials(name)}</span>
                      <div className="min-w-0">
                        <div className="text-base font-semibold">{name || "Sem nome"}</div>
                        <div className="text-xs text-muted-foreground">{segment} · {city || "—"}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <Field label="Contato" value={contactName || "—"} />
                      <Field label="E-mail" value={contactEmail || "—"} />
                      <Field label="Telefone" value={contactPhone || "—"} />
                      <Field label="Status" value={STATUSES.find(s => s.id === status)!.label} />
                      <Field label="Responsável" value={users.find(u => u.id === ownerId)?.name || "—"} />
                      <Field label="LTV" value={formatBRL(typeof ltv === "number" ? ltv : 0)} />
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
                <Button onClick={submit} disabled={!name.trim()}>
                  <CheckCircle2 className="h-4 w-4" /> Criar cliente
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
