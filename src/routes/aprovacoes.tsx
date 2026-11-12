import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApprovals, approvalsStore } from "@/lib/store";
import { approvalTypeMeta, approvalStatusMeta, getUser, getClient, formatBRL, type ApprovalRequest, type ApprovalStatus, type ApprovalType } from "@/lib/mock-data";
import { Plus, CheckCircle2, XCircle, Clock, AlertTriangle, FileText, ChevronRight, Paperclip } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/aprovacoes")({ head: () => ({ meta: [{ title: 'Aprovações | Grupo Sorrisos' }, { name: 'description', content: 'Solicitações e decisões corporativas do Grupo Sorrisos.' }, { property: 'og:title', content: 'Aprovações | Grupo Sorrisos' }, { property: 'og:description', content: 'Acompanhamento de aprovações e solicitações.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }), component: AprovacoesPage });

// Demo: o "eu" é o approver da primeira etapa pendente; aqui usamos u2 (Sofia — Diretora)
const ME_ID = "u2";

type Tab = "pendentes" | "minhas" | "todas";

export default function AprovacoesPage() {
  const all = useApprovals();
  const [tab, setTab] = useState<Tab>("pendentes");
  const [open, setOpen] = useState<ApprovalRequest | null>(null);

  const myPending = (r: ApprovalRequest) => {
    const current = r.steps.find(s => s.status === "pendente");
    return current?.approverId === ME_ID && r.status === "pendente";
  };

  const filtered = useMemo(() => {
    if (tab === "pendentes") return all.filter(myPending);
    if (tab === "minhas") return all.filter(r => r.requesterId === ME_ID);
    return all;
  }, [all, tab]);

  const kpis = useMemo(() => ({
    pendingForMe: all.filter(myPending).length,
    totalPending: all.filter(r => r.status === "pendente").length,
    approvedThisMonth: all.filter(r => r.status === "aprovado" && (r.steps.at(-1)?.decidedAt || "").startsWith("2026-06")).length,
    valuePending: all.filter(r => r.status === "pendente").reduce((s, r) => s + (r.amount || 0), 0),
  }), [all]);

  return (
    <AppShell title="Aprovações & Workflows" subtitle="Solicitações que precisam de decisão" primaryAction={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Solicitação</Button>}>
      <div className="p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI icon={AlertTriangle} label="Aguardando minha decisão" value={String(kpis.pendingForMe)} tone="warning" />
          <KPI icon={Clock}         label="Pendentes (total)"        value={String(kpis.totalPending)} tone="info" />
          <KPI icon={CheckCircle2}  label="Aprovadas (mês)"          value={String(kpis.approvedThisMonth)} tone="success" />
          <KPI icon={FileText}      label="Valor pendente"           value={formatBRL(kpis.valuePending)} tone="primary" />
        </div>

        <div className="flex gap-1 border-b border-border">
          {(["pendentes", "minhas", "todas"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm border-b-2 transition-colors -mb-px ${tab === t ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "pendentes" ? `Aguardando minha decisão (${kpis.pendingForMe})` : t === "minhas" ? "Minhas solicitações" : "Todas"}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map(r => <ApprovalRow key={r.id} r={r} onOpen={() => setOpen(r)} />)}
          {filtered.length === 0 && <Card className="p-10 text-center text-sm text-muted-foreground">Nada por aqui ✨</Card>}
        </div>
      </div>

      <ApprovalDrawer req={open} onClose={() => setOpen(null)} />
    </AppShell>
  );
}

function KPI({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "primary"|"success"|"warning"|"info" }) {
  const cls = { primary: "bg-primary/10 text-primary", success: "bg-success/10 text-success", warning: "bg-warning/10 text-warning", info: "bg-info/10 text-info" }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`h-7 w-7 rounded-md flex items-center justify-center ${cls}`}><Icon className="h-3.5 w-3.5" /></div>
      </div>
      <div className="text-lg font-bold">{value}</div>
    </Card>
  );
}

function ApprovalRow({ r, onOpen }: { r: ApprovalRequest; onOpen: () => void }) {
  const typeMeta = approvalTypeMeta[r.type];
  const statusMeta = approvalStatusMeta[r.status];
  const requester = getUser(r.requesterId);
  const currentStep = r.steps.find(s => s.status === "pendente");
  const currentApprover = currentStep ? getUser(currentStep.approverId) : null;

  return (
    <Card className="p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer" onClick={onOpen}>
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: typeMeta.color + "22" }}>
          {typeMeta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-semibold truncate">{r.title}</div>
            <Badge className={`${statusMeta.className} text-[10px] border-0`}>{statusMeta.label}</Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{typeMeta.label}</span>
            <span>•</span>
            <span>por {requester?.name}</span>
            <span>•</span>
            <span>{new Date(r.createdAt).toLocaleDateString("pt-BR")}</span>
            {r.attachments && r.attachments.length > 0 && (<><span>•</span><span><Paperclip className="h-3 w-3 inline" /> {r.attachments.length}</span></>)}
          </div>
        </div>
        {r.amount && <div className="text-sm font-semibold text-primary shrink-0">{formatBRL(r.amount)}</div>}
        <StepIndicator steps={r.steps} />
        {currentApprover && r.status === "pendente" && (
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground shrink-0">
            <span>com</span>
            <Avatar className="h-6 w-6"><AvatarFallback style={{ backgroundColor: currentApprover.color, color: "white", fontSize: 9 }}>{currentApprover.initials}</AvatarFallback></Avatar>
          </div>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </Card>
  );
}

function StepIndicator({ steps }: { steps: ApprovalRequest["steps"] }) {
  return (
    <div className="hidden md:flex items-center gap-1 shrink-0">
      {steps.map(s => (
        <div key={s.id} className={`h-1.5 w-6 rounded-full ${s.status === "aprovado" ? "bg-success" : s.status === "rejeitado" ? "bg-destructive" : "bg-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

function ApprovalDrawer({ req, onClose }: { req: ApprovalRequest | null; onClose: () => void }) {
  const [note, setNote] = useState("");
  if (!req) return null;
  const typeMeta = approvalTypeMeta[req.type];
  const statusMeta = approvalStatusMeta[req.status];
  const requester = getUser(req.requesterId);
  const client = getClient(req.relatedClientId);
  const currentStep = req.steps.find(s => s.status === "pendente");
  const isMyTurn = currentStep?.approverId === ME_ID && req.status === "pendente";

  const decide = (decision: "aprovado" | "rejeitado") => {
    if (!currentStep) return;
    approvalsStore.decideStep(req.id, currentStep.id, decision, note || undefined);
    setNote("");
    onClose();
  };

  return (
    <Dialog open={!!req} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: typeMeta.color + "22" }}>{typeMeta.icon}</div>
            <div className="flex-1">
              <DialogTitle className="text-base text-left">{req.title}</DialogTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge className={`${statusMeta.className} text-[10px] border-0`}>{statusMeta.label}</Badge>
                <span className="text-xs text-muted-foreground">{typeMeta.label}</span>
                {req.amount && <span className="text-sm font-semibold text-primary">{formatBRL(req.amount)}</span>}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="text-sm leading-relaxed bg-muted/40 rounded-lg p-3">{req.description}</div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="Solicitante" value={requester?.name || "—"} />
            <InfoRow label="Criado em"   value={new Date(req.createdAt).toLocaleDateString("pt-BR")} />
            {req.dueDate && <InfoRow label="Prazo" value={new Date(req.dueDate).toLocaleDateString("pt-BR")} />}
            {client && <InfoRow label="Cliente" value={client.name} />}
          </div>

          {req.attachments && req.attachments.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">Anexos</div>
              <div className="space-y-1.5">
                {req.attachments.map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-sm p-2 rounded border border-border">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="text-xs text-muted-foreground">{a.size}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold mb-2 uppercase tracking-wide text-muted-foreground">Fluxo de aprovação</div>
            <div className="space-y-2">
              {req.steps.map((s, i) => {
                const u = getUser(s.approverId);
                const icon = s.status === "aprovado" ? <CheckCircle2 className="h-4 w-4 text-success" />
                  : s.status === "rejeitado" ? <XCircle className="h-4 w-4 text-destructive" />
                  : <Clock className="h-4 w-4 text-warning animate-pulse" />;
                return (
                  <div key={s.id} className={`flex items-start gap-3 p-3 rounded-lg border ${s.status === "pendente" ? "border-warning/40 bg-warning/5" : "border-border"}`}>
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">{i + 1}</div>
                      {i < req.steps.length - 1 && <div className="w-px h-6 bg-border" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {u && <Avatar className="h-6 w-6"><AvatarFallback style={{ backgroundColor: u.color, color: "white", fontSize: 9 }}>{u.initials}</AvatarFallback></Avatar>}
                        <div className="text-sm font-medium">{u?.name}</div>
                        <div className="ml-auto">{icon}</div>
                      </div>
                      {s.decidedAt && <div className="text-[10px] text-muted-foreground mt-1">{new Date(s.decidedAt).toLocaleDateString("pt-BR")}</div>}
                      {s.note && <div className="text-xs italic mt-1.5 text-muted-foreground border-l-2 border-border pl-2">"{s.note}"</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {isMyTurn && (
            <div className="space-y-2 pt-3 border-t border-border">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sua decisão</div>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Comentário opcional..." rows={2} />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 bg-success hover:bg-success/90 text-white" onClick={() => decide("aprovado")}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />Aprovar
                </Button>
                <Button size="sm" variant="destructive" className="flex-1" onClick={() => decide("rejeitado")}>
                  <XCircle className="h-4 w-4 mr-1.5" />Rejeitar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
