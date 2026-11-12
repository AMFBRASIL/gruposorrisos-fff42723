import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, ChevronRight, Sparkles, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import stockBg from "@/assets/wizard-stock-bg.jpg";

export type WizardStep = { title: string; desc: string; icon: LucideIcon };

/** Shared large wizard modal: image sidebar with steps + progress, scrollable content, footer. */
export function WizardShell({ open, onClose, badge, headline, sub, steps, step, setStep, footer, children, bg = stockBg }: {
  open: boolean; onClose: () => void; badge: string; headline: ReactNode; sub?: string;
  steps: WizardStep[]; step: number; setStep: (n: number) => void; footer: ReactNode; children: ReactNode; bg?: string;
}) {
  const pct = ((step + 1) / steps.length) * 100;
  const cur = steps[step];
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-6xl w-[96vw] p-0 overflow-hidden gap-0 border-0 [&>button]:hidden h-[90vh] max-h-[860px]">
        <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] h-full min-h-0">
          <aside className="relative hidden md:flex flex-col justify-between p-8 text-sidebar-foreground overflow-hidden" style={{ backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, color-mix(in oklab, var(--sidebar) 82%, transparent), color-mix(in oklab, var(--sidebar) 96%, transparent))" }} />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-sidebar-accent/60 backdrop-blur px-3 py-1.5 text-[11px] font-medium border border-sidebar-border"><Sparkles className="h-3 w-3" />{badge}</div>
              <h2 className="mt-6 text-3xl font-semibold leading-tight tracking-tight">{headline}</h2>
              {sub && <p className="mt-3 text-sm opacity-70">{sub}</p>}
            </div>
            <ol className="relative space-y-1.5">
              {steps.map((s, i) => { const Icon = s.icon; const active = i === step; const done = i < step; return (
                <li key={s.title}>
                  <button type="button" onClick={() => i <= step && setStep(i)} className={`w-full flex items-start gap-3.5 rounded-2xl p-3.5 text-left transition-all border ${active ? "bg-sidebar-accent/70 backdrop-blur border-sidebar-border shadow-lg" : "border-transparent hover:bg-sidebar-accent/30"}`}>
                    <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all ${done ? "bg-success border-success text-success-foreground" : active ? "bg-sidebar-primary text-sidebar-primary-foreground border-sidebar-primary scale-110" : "bg-sidebar-accent/40 border-sidebar-border opacity-70"}`}>
                      {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="text-sm font-semibold flex items-center gap-2">{s.title}{active && <ChevronRight className="h-3.5 w-3.5 opacity-70" />}</div>
                      <div className="text-[11px] opacity-60 leading-snug mt-0.5">{s.desc}</div>
                    </div>
                  </button>
                </li>
              ); })}
            </ol>
            <div className="relative space-y-2">
              <div className="flex justify-between text-[11px] opacity-70"><span>Progresso</span><span className="font-semibold">{Math.round(pct)}%</span></div>
              <div className="h-1.5 rounded-full bg-sidebar-accent overflow-hidden"><div className="h-full bg-sidebar-primary transition-all duration-500" style={{ width: `${pct}%` }} /></div>
              <div className="text-[11px] opacity-60">Passo {step + 1} de {steps.length}</div>
            </div>
          </aside>
          <div className="flex flex-col bg-background min-h-0 h-full">
            <div className="flex items-start justify-between px-8 pt-6 gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Etapa {step + 1} de {steps.length}</div>
                <DialogTitle className="text-2xl font-semibold tracking-tight mt-1">{cur.title}</DialogTitle>
                <DialogDescription className="mt-1">{cur.desc}</DialogDescription>
              </div>
              <Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
            <div className="md:hidden px-8 pt-3"><div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div></div>
            <div className="flex-1 px-8 py-6 overflow-y-auto"><div key={step} className="animate-fade-in space-y-6">{children}</div></div>
            <div className="flex justify-between gap-2 px-8 py-4 border-t border-border bg-muted/30">{footer}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OptionCard({ selected, onClick, icon: Icon, title, desc, compact }: { selected: boolean; onClick: () => void; icon?: LucideIcon; title: string; desc?: string; compact?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`relative rounded-xl border text-left transition-all ${compact ? "p-3" : "p-5"} ${selected ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm" : "border-border hover:border-primary/40 hover:bg-muted/40"}`}>
      {selected && <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-primary" />}
      {Icon && <span className={`flex items-center justify-center rounded-lg mb-3 ${compact ? "h-8 w-8" : "h-11 w-11"} ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}><Icon className={compact ? "h-4 w-4" : "h-5 w-5"} /></span>}
      <div className="font-semibold text-sm capitalize">{title}</div>
      {desc && <div className="text-xs text-muted-foreground mt-1 leading-snug">{desc}</div>}
    </button>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{children}</div>;
}

export function ReviewGrid({ items }: { items: [string, ReactNode][] }) {
  return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{items.map(([k, v]) => <div key={k} className="rounded-xl border border-border p-4 bg-card"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</div><div className="font-semibold mt-1">{v}</div></div>)}</div>;
}

export function WizardFooter({ step, last, onClose, setStep, onFinish, finishLabel, canNext = true, extra }: { step: number; last: number; onClose: () => void; setStep: (n: number) => void; onFinish: () => void; finishLabel: string; canNext?: boolean; extra?: ReactNode }) {
  return (<>
    <Button variant="outline" onClick={() => step === 0 ? onClose() : setStep(step - 1)}>{step === 0 ? "Cancelar" : "Voltar"}</Button>
    <div className="flex gap-2">{extra}{step < last ? <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Próximo</Button> : <Button disabled={!canNext} onClick={onFinish}>{finishLabel}</Button>}</div>
  </>);
}

export const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
