import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  CalendarDays, Sparkles, Receipt, Building2, CheckCircle2,
  ArrowRight, ArrowLeft, X, Plus, Trash2, ListChecks,
} from "lucide-react";
import { invoicesStore, useClients, useProjects } from "@/lib/store";
import { formatBRL, type Invoice, type InvoiceItem, type InvoiceStatus } from "@/lib/mock-data";
import wizardBg from "@/assets/wizard-bg.jpg";

const STEPS = [
  { id: 0, title: "Cliente", desc: "Para quem faturar", icon: Building2 },
  { id: 1, title: "Itens", desc: "Serviços e valores", icon: ListChecks },
  { id: 2, title: "Prazos", desc: "Emissão e vencimento", icon: CalendarDays },
  { id: 3, title: "Revisão", desc: "Confirme e emita", icon: CheckCircle2 },
];

const STATUSES: { id: InvoiceStatus; label: string; desc: string }[] = [
  { id: "rascunho", label: "Rascunho", desc: "Ainda não enviada" },
  { id: "enviada", label: "Enviada", desc: "Aguardando pagamento" },
  { id: "paga", label: "Paga", desc: "Liquidada" },
];

const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;
const plusDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

export function CreateInvoiceWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const projects = useProjects();
  const clients = useClients();
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [number, setNumber] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(plusDays(30));
  const [status, setStatus] = useState<InvoiceStatus>("rascunho");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setClientId(clients[0]?.id || "");
    setProjectId(undefined);
    setNumber(`FAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setItems([{ id: uid("it"), description: "", quantity: 1, unitPrice: 0 }]);
    setIssueDate(todayISO()); setDueDate(plusDays(30));
    setStatus("rascunho"); setNotes("");
  }, [open]);

  useEffect(() => {
    if (open && !clientId && clients[0]) setClientId(clients[0].id);
  }, [open, clientId, clients]);

  const total = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unitPrice, 0), [items]);

  const addItem = () => setItems(i => [...i, { id: uid("it"), description: "", quantity: 1, unitPrice: 0 }]);
  const updateItem = (idx: number, patch: Partial<InvoiceItem>) =>
    setItems(list => list.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const removeItem = (idx: number) => setItems(list => list.filter((_, i) => i !== idx));

  const canNext =
    step === 0 ? !!clientId && number.trim().length > 0 :
    step === 1 ? items.length > 0 && items.every(i => i.description.trim() && i.unitPrice >= 0) && total > 0 :
    true;

  const submit = () => {
    if (!clientId || !number.trim()) return;
    const inv: Invoice = {
      id: uid("inv"),
      number: number.trim(),
      clientId,
      projectId,
      issueDate,
      dueDate,
      status,
      items,
      notes: notes.trim() || undefined,
      ...(status === "paga" ? { paidAt: todayISO() } : {}),
    };
    invoicesStore.addInvoice(inv);
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
                <Sparkles className="h-3 w-3" /> Nova fatura
              </div>
              <h2 className="mt-5 text-2xl font-semibold leading-tight">Faturamento claro,<br />caixa saudável.</h2>
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
            <div className="relative">
              <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 p-3 mb-4">
                <div className="text-[10px] uppercase tracking-wide text-white/60">Total da fatura</div>
                <div className="text-xl font-semibold">{formatBRL(total)}</div>
              </div>
              <div className="text-[11px] text-white/60">
                Passo {step + 1} de {STEPS.length}
                <div className="mt-2 h-1 w-full rounded-full bg-white/15 overflow-hidden">
                  <div className="h-full bg-white transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
                </div>
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
                    <h3 className="text-xl font-semibold">Cliente & vínculo</h3>
                    <p className="text-sm text-muted-foreground mt-1">Para quem esta fatura será emitida.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Número</Label>
                      <Input value={number} onChange={e => setNumber(e.target.value)} className="mt-2 h-11" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Projeto (opcional)</Label>
                      <select value={projectId || ""} onChange={e => setProjectId(e.target.value || undefined)}
                        className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option value="">— Nenhum —</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</Label>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">Itens da fatura</h3>
                      <p className="text-sm text-muted-foreground mt-1">Descreva os serviços cobrados.</p>
                    </div>
                    <Button size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Item</Button>
                  </div>
                  <ul className="space-y-3">
                    {items.map((it, i) => (
                      <li key={it.id} className="rounded-xl border border-border bg-card/40 p-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">{i + 1}</span>
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_90px_130px_120px] gap-2">
                            <Input value={it.description} onChange={e => updateItem(i, { description: e.target.value })} placeholder="Descrição do serviço" className="h-9" />
                            <Input type="number" min={1} value={it.quantity} onChange={e => updateItem(i, { quantity: Number(e.target.value) || 0 })} placeholder="Qtd" className="h-9" />
                            <CurrencyInput aria-label={`Valor unitário do item ${i + 1}`} value={it.unitPrice} onValueChange={value => updateItem(i, { unitPrice: value === "" ? 0 : value })} className="h-9" />
                            <div className="h-9 flex items-center justify-end text-sm font-medium">{formatBRL(it.quantity * it.unitPrice)}</div>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => removeItem(i)} className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-end items-baseline gap-3 border-t pt-4">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Total</span>
                    <span className="text-2xl font-semibold">{formatBRL(total)}</span>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-semibold">Prazos & status</h3>
                    <p className="text-sm text-muted-foreground mt-1">Datas de emissão, vencimento e situação.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Emissão</Label>
                      <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="mt-2 h-11" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Vencimento</Label>
                      <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-2 h-11" />
                    </div>
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
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Observações</Label>
                    <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
                      placeholder="Condições de pagamento, dados bancários..." className="mt-2 resize-none" />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-semibold">Tudo certo?</h3>
                    <p className="text-sm text-muted-foreground mt-1">Revise antes de emitir a fatura.</p>
                  </div>
                  <div className="rounded-xl border bg-card/40 p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="h-12 w-12 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                        <Receipt className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-base font-semibold">{number}</div>
                        <div className="text-xs text-muted-foreground">
                          {clients.find(c => c.id === clientId)?.name || "—"}
                          {projectId && ` · ${projects.find(p => p.id === projectId)?.name}`}
                        </div>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</div>
                        <div className="text-xl font-semibold">{formatBRL(total)}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <Field label="Emissão" value={issueDate} />
                      <Field label="Vencimento" value={dueDate} />
                      <Field label="Status" value={STATUSES.find(s => s.id === status)!.label} />
                      <Field label="Itens" value={String(items.length)} />
                      <Field label="Observações" value={notes.trim() ? "Sim" : "—"} />
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
                <Button onClick={submit} disabled={!clientId || total <= 0}>
                  <CheckCircle2 className="h-4 w-4" /> Emitir fatura
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
