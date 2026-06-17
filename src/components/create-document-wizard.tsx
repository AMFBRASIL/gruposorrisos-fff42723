import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays, Sparkles, FileText, Users, CheckCircle2,
  ArrowRight, ArrowLeft, X, Plus, Trash2, PenTool, Tag, Building2,
} from "lucide-react";
import { documentsStore } from "@/lib/store";
import {
  documentTypeMeta, clients, users, projects,
  type Document, type DocumentType, type DocumentSignatory,
} from "@/lib/mock-data";
import wizardBg from "@/assets/wizard-bg.jpg";

const STEPS = [
  { id: 0, title: "Identidade",   desc: "Título e tipo",          icon: FileText },
  { id: 1, title: "Detalhes",     desc: "Cliente, projeto e valor", icon: Building2 },
  { id: 2, title: "Signatários",  desc: "Quem irá assinar",       icon: Users },
  { id: 3, title: "Revisão",      desc: "Confirme e crie",        icon: CheckCircle2 },
];

const TYPES: DocumentType[] = ["contrato", "proposta", "termo", "relatorio", "nf", "outro"];

const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

export function CreateDocumentWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocumentType>("contrato");
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [ownerId, setOwnerId] = useState<string>(users[0]?.id || "");
  const [value, setValue] = useState<number | "">("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [tagsInput, setTagsInput] = useState("");
  const [signatories, setSignatories] = useState<DocumentSignatory[]>([]);

  useEffect(() => {
    if (!open) return;
    setStep(0); setTitle(""); setType("contrato");
    setClientId(undefined); setProjectId(undefined); setOwnerId(users[0]?.id || "");
    setValue(""); setExpiresAt(""); setTagsInput(""); setSignatories([]);
  }, [open]);

  const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);

  const addSig = () => setSignatories(s => [...s, { id: uid("s"), name: "", email: "", role: "", status: "pendente" }]);
  const updateSig = (i: number, patch: Partial<DocumentSignatory>) =>
    setSignatories(s => s.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const removeSig = (i: number) => setSignatories(s => s.filter((_, idx) => idx !== i));

  const canNext =
    step === 0 ? title.trim().length > 0 :
    step === 1 ? true :
    step === 2 ? signatories.every(s => s.name.trim() && s.email.trim()) :
    true;

  const submit = () => {
    if (!title.trim()) return;
    const doc: Document = {
      id: uid("doc"),
      title: title.trim(),
      type,
      status: "rascunho",
      clientId, projectId, ownerId,
      createdAt: todayISO(),
      updatedAt: todayISO(),
      expiresAt: expiresAt || undefined,
      tags,
      versions: [{ id: uid("v"), version: 1, createdAt: todayISO(), createdBy: ownerId, note: "Versão inicial", size: "120 KB" }],
      signatories,
      value: typeof value === "number" ? value : undefined,
    };
    documentsStore.addDocument(doc);
    onClose();
  };

  const prettyDate = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const typeMeta = documentTypeMeta[type];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0 border-0 [&>button]:hidden">
        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] min-h-[640px]">
          <aside
            className="relative hidden md:flex flex-col justify-between p-7 text-white overflow-hidden"
            style={{ backgroundImage: `url(${wizardBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-black/55 via-black/40 to-black/70" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-[11px] font-medium border border-white/20">
                <Sparkles className="h-3 w-3" /> Novo documento
              </div>
              <h2 className="mt-5 text-2xl font-semibold leading-tight">Contratos, propostas<br/>e termos centralizados.</h2>
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
                    <h3 className="text-xl font-semibold">Identidade do documento</h3>
                    <p className="text-sm text-muted-foreground mt-1">Defina o título e o tipo do documento.</p>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Título</Label>
                    <Input autoFocus value={title} onChange={e => setTitle(e.target.value)}
                      placeholder="Ex.: Contrato de Prestação — Cliente X" className="mt-2 h-12 text-base" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</Label>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                      {TYPES.map(t => {
                        const m = documentTypeMeta[t];
                        const sel = type === t;
                        return (
                          <button key={t} type="button" onClick={() => setType(t)}
                            className={`rounded-xl border p-3 text-left transition-all flex items-center gap-3 ${sel ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"}`}>
                            <span className="h-10 w-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                              style={{ backgroundColor: m.color + "22", color: m.color }}>{m.icon}</span>
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{m.label}</div>
                              <div className="text-[10px] text-muted-foreground">Documento do tipo {m.label.toLowerCase()}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-semibold">Detalhes & vínculos</h3>
                    <p className="text-sm text-muted-foreground mt-1">Associe ao cliente, projeto e responsável.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</Label>
                      <select value={clientId || ""} onChange={e => setClientId(e.target.value || undefined)}
                        className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option value="">— Nenhum —</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Projeto</Label>
                      <select value={projectId || ""} onChange={e => setProjectId(e.target.value || undefined)}
                        className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option value="">— Nenhum —</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Responsável</Label>
                      <select value={ownerId} onChange={e => setOwnerId(e.target.value)}
                        className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Valor (R$)</Label>
                      <Input type="number" min={0} value={value}
                        onChange={e => setValue(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="Opcional" className="mt-2 h-11" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Data de expiração</Label>
                      <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="mt-2 h-11" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5" /> Tags
                      </Label>
                      <Input value={tagsInput} onChange={e => setTagsInput(e.target.value)}
                        placeholder="Separe por vírgula" className="mt-2 h-11" />
                      {tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tags.map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">Signatários</h3>
                      <p className="text-sm text-muted-foreground mt-1">Adicione quem precisa assinar o documento.</p>
                    </div>
                    <Button size="sm" onClick={addSig}><Plus className="h-4 w-4 mr-1" /> Signatário</Button>
                  </div>
                  {signatories.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                      <PenTool className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      Nenhum signatário ainda. Você pode prosseguir e adicionar depois.
                    </div>
                  )}
                  <ul className="space-y-3">
                    {signatories.map((s, i) => (
                      <li key={s.id} className="rounded-xl border border-border bg-card/40 p-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">{i+1}</span>
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                            <Input value={s.name} onChange={e => updateSig(i, { name: e.target.value })} placeholder="Nome" className="h-9" />
                            <Input value={s.email} onChange={e => updateSig(i, { email: e.target.value })} placeholder="E-mail" className="h-9" />
                            <Input value={s.role} onChange={e => updateSig(i, { role: e.target.value })} placeholder="Cargo" className="h-9" />
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => removeSig(i)} className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive">
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
                  <div>
                    <h3 className="text-xl font-semibold">Tudo certo?</h3>
                    <p className="text-sm text-muted-foreground mt-1">Revise antes de criar o documento.</p>
                  </div>
                  <div className="rounded-xl border bg-card/40 p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="h-12 w-12 rounded-lg flex items-center justify-center text-2xl shrink-0"
                        style={{ backgroundColor: typeMeta.color + "22", color: typeMeta.color }}>
                        {typeMeta.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="text-base font-semibold">{title || "Sem título"}</div>
                        <div className="text-xs text-muted-foreground">
                          {typeMeta.label}
                          {clientId && ` · ${clients.find(c => c.id === clientId)?.name}`}
                          {projectId && ` · ${projects.find(p => p.id === projectId)?.name}`}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <Field label="Responsável" value={users.find(u => u.id === ownerId)?.name || "—"} />
                      <Field label="Valor" value={typeof value === "number" ? `R$ ${value.toLocaleString("pt-BR")}` : "—"} />
                      <Field label="Expira em" value={expiresAt || "—"} />
                      <Field label="Signatários" value={String(signatories.length)} />
                      <Field label="Tags" value={tags.length ? tags.join(", ") : "—"} />
                      <Field label="Status inicial" value="Rascunho" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t px-7 py-4 bg-muted/30">
              <Button variant="ghost" onClick={step === 0 ? onClose : () => setStep(s => s - 1)}>
                {step === 0 ? "Cancelar" : (<><ArrowLeft className="h-4 w-4" /> Voltar</>)}
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep(s => s + 1)} disabled={!canNext}>
                  Continuar <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={submit} disabled={!title.trim()}>
                  <CheckCircle2 className="h-4 w-4" /> Criar documento
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
