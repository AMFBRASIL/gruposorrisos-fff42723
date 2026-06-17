import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDocuments, documentsStore } from "@/lib/store";
import { documentTypeMeta, documentStatusMeta, getUser, getClient, formatBRL, type DocumentStatus, type DocumentType, type Document } from "@/lib/mock-data";
import { FileText, Plus, Search, Clock, CheckCircle2, AlertTriangle, History, PenTool, Download, Archive, FileSignature, Calendar } from "lucide-react";
import { useMemo, useState } from "react";
import { CreateDocumentWizard } from "@/components/create-document-wizard";

export const Route = createFileRoute("/documentos")({ component: DocumentosPage });

const TYPE_FILTERS: Array<{ id: "all" | DocumentType; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "contrato", label: "Contratos" },
  { id: "proposta", label: "Propostas" },
  { id: "termo", label: "Termos" },
  { id: "relatorio", label: "Relatórios" },
];
const STATUS_FILTERS: Array<{ id: "all" | DocumentStatus; label: string }> = [
  { id: "all", label: "Todos status" },
  { id: "rascunho", label: "Rascunho" },
  { id: "revisao", label: "Em revisão" },
  { id: "aguardando_assinatura", label: "Aguardando assinatura" },
  { id: "assinado", label: "Assinado" },
  { id: "expirado", label: "Expirado" },
];

function DocumentosPage() {
  const docs = useDocuments();
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | DocumentType>("all");
  const [status, setStatus] = useState<"all" | DocumentStatus>("all");
  const [openDoc, setOpenDoc] = useState<Document | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const filtered = useMemo(() => {
    return docs.filter(d => {
      if (type !== "all" && d.type !== type) return false;
      if (status !== "all" && d.status !== status) return false;
      if (q && !d.title.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [docs, q, type, status]);

  const kpis = useMemo(() => {
    const pendingSig = docs.filter(d => d.status === "aguardando_assinatura").length;
    const expiringSoon = docs.filter(d => {
      if (!d.expiresAt) return false;
      const days = Math.round((new Date(d.expiresAt).getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= 30 && d.status !== "expirado" && d.status !== "arquivado";
    }).length;
    const signedThisMonth = docs.filter(d => d.status === "assinado" && d.updatedAt.startsWith("2026-06")).length;
    const totalValue = docs.filter(d => d.status === "assinado" || d.status === "aguardando_assinatura").reduce((s, d) => s + (d.value || 0), 0);
    return { pendingSig, expiringSoon, signedThisMonth, totalValue, total: docs.length };
  }, [docs]);

  return (
    <AppShell title="Documentos" subtitle="Contratos, propostas e termos" primaryAction={<Button size="sm" onClick={() => setWizardOpen(true)}><Plus className="h-4 w-4 mr-1" /> Novo Documento</Button>}>
      <div className="p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPI icon={FileText}  label="Total"                 value={String(kpis.total)}            tone="primary" />
          <KPI icon={PenTool}   label="Aguardando assinatura" value={String(kpis.pendingSig)}       tone="info" />
          <KPI icon={AlertTriangle} label="Expira em ≤ 30 dias" value={String(kpis.expiringSoon)}  tone="warning" />
          <KPI icon={CheckCircle2}  label="Assinados (mês)"     value={String(kpis.signedThisMonth)} tone="success" />
          <KPI icon={FileSignature} label="Valor em contratos"  value={formatBRL(kpis.totalValue)}   tone="primary" />
        </div>

        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por título..." className="pl-9 h-9" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {TYPE_FILTERS.map(f => (
                <Button key={f.id} size="sm" variant={type === f.id ? "default" : "outline"} onClick={() => setType(f.id)}>{f.label}</Button>
              ))}
            </div>
            <select value={status} onChange={e => setStatus(e.target.value as any)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              {STATUS_FILTERS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </Card>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(d => <DocCard key={d.id} doc={d} onOpen={() => setOpenDoc(d)} />)}
          {filtered.length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
              Nenhum documento encontrado com os filtros atuais.
            </Card>
          )}
        </div>
      </div>

      <DocumentDrawer doc={openDoc} onClose={() => setOpenDoc(null)} />
      <CreateDocumentWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
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

function DocCard({ doc, onOpen }: { doc: Document; onOpen: () => void }) {
  const typeMeta = documentTypeMeta[doc.type];
  const statusMeta = documentStatusMeta[doc.status];
  const client = getClient(doc.clientId);
  const owner = getUser(doc.ownerId);
  const signedCount = doc.signatories.filter(s => s.status === "assinado").length;
  const expiresIn = doc.expiresAt ? Math.round((new Date(doc.expiresAt).getTime() - Date.now()) / 86400000) : null;

  return (
    <Card className="p-4 hover:shadow-md transition-all cursor-pointer group" onClick={onOpen}>
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: typeMeta.color + "22", color: typeMeta.color }}>
          {typeMeta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">{doc.title}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{typeMeta.label} • v{doc.versions.length}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <Badge className={`${statusMeta.className} text-[10px] border-0`}>{statusMeta.label}</Badge>
        {doc.tags.slice(0, 2).map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
      </div>

      {client && <div className="text-xs text-muted-foreground mb-2 truncate">📋 {client.name}</div>}
      {doc.value && <div className="text-sm font-semibold text-primary mb-2">{formatBRL(doc.value)}</div>}

      {doc.signatories.length > 0 && (
        <div className="text-[11px] text-muted-foreground mb-2">
          ✍️ {signedCount}/{doc.signatories.length} assinatura{doc.signatories.length > 1 ? "s" : ""}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {owner && <Avatar className="h-5 w-5"><AvatarFallback style={{ backgroundColor: owner.color, color: "white", fontSize: 9 }}>{owner.initials}</AvatarFallback></Avatar>}
          <span>v{doc.versions.length} • {new Date(doc.updatedAt).toLocaleDateString("pt-BR")}</span>
        </div>
        {expiresIn !== null && (
          <div className={`flex items-center gap-1 ${expiresIn < 0 ? "text-destructive" : expiresIn <= 30 ? "text-warning" : ""}`}>
            <Clock className="h-2.5 w-2.5" />
            {expiresIn < 0 ? `expirou há ${-expiresIn}d` : `${expiresIn}d`}
          </div>
        )}
      </div>
    </Card>
  );
}

function DocumentDrawer({ doc, onClose }: { doc: Document | null; onClose: () => void }) {
  if (!doc) return null;
  const typeMeta = documentTypeMeta[doc.type];
  const statusMeta = documentStatusMeta[doc.status];
  const client = getClient(doc.clientId);
  const owner = getUser(doc.ownerId);

  return (
    <Dialog open={!!doc} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: typeMeta.color + "22", color: typeMeta.color }}>
              {typeMeta.icon}
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base text-left">{doc.title}</DialogTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge className={`${statusMeta.className} text-[10px] border-0`}>{statusMeta.label}</Badge>
                <span className="text-xs text-muted-foreground">{typeMeta.label}</span>
                {doc.value && <span className="text-sm font-semibold text-primary">{formatBRL(doc.value)}</span>}
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1">Informações</TabsTrigger>
            <TabsTrigger value="versions" className="flex-1">Versões ({doc.versions.length})</TabsTrigger>
            <TabsTrigger value="signatures" className="flex-1">Assinaturas ({doc.signatories.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Cliente"     value={client?.name || "—"} />
              <InfoRow label="Responsável" value={owner?.name || "—"} />
              <InfoRow label="Criado em"   value={new Date(doc.createdAt).toLocaleDateString("pt-BR")} />
              <InfoRow label="Atualizado"  value={new Date(doc.updatedAt).toLocaleDateString("pt-BR")} />
              {doc.expiresAt && <InfoRow label="Expira em" value={new Date(doc.expiresAt).toLocaleDateString("pt-BR")} />}
            </div>
            {doc.tags.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-1.5">Tags</div>
                <div className="flex flex-wrap gap-1.5">{doc.tags.map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}</div>
              </div>
            )}
            <div className="flex gap-2 pt-3 border-t border-border">
              <Button size="sm" variant="outline"><Download className="h-3.5 w-3.5 mr-1.5" /> Baixar PDF</Button>
              {doc.status === "rascunho" && <Button size="sm" onClick={() => { documentsStore.setStatus(doc.id, "revisao"); onClose(); }}>Enviar para revisão</Button>}
              {doc.status === "revisao" && <Button size="sm" onClick={() => { documentsStore.setStatus(doc.id, "aguardando_assinatura"); onClose(); }}><PenTool className="h-3.5 w-3.5 mr-1.5" />Solicitar assinatura</Button>}
              {doc.status !== "arquivado" && <Button size="sm" variant="ghost" onClick={() => { documentsStore.setStatus(doc.id, "arquivado"); onClose(); }}><Archive className="h-3.5 w-3.5 mr-1.5" />Arquivar</Button>}
            </div>
          </TabsContent>

          <TabsContent value="versions" className="space-y-2 mt-4">
            {doc.versions.slice().reverse().map((v, i) => {
              const u = getUser(v.createdBy);
              return (
                <div key={v.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">v{v.version}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      Versão {v.version} {i === 0 && <Badge variant="outline" className="text-[9px]">atual</Badge>}
                    </div>
                    {v.note && <div className="text-xs text-muted-foreground mt-0.5">{v.note}</div>}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span><History className="h-2.5 w-2.5 inline mr-1" />{new Date(v.createdAt).toLocaleDateString("pt-BR")}</span>
                      {u && <span>por {u.name}</span>}
                      <span>{v.size}</span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7"><Download className="h-3 w-3" /></Button>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="signatures" className="space-y-2 mt-4">
            {doc.signatories.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Sem signatários cadastrados.</div>}
            {doc.signatories.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <Avatar className="h-9 w-9"><AvatarFallback className="text-xs">{s.name.split(" ").map(n => n[0]).slice(0, 2).join("")}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.role} • {s.email}</div>
                  {s.signedAt && <div className="text-[10px] text-success mt-0.5"><Calendar className="h-2.5 w-2.5 inline mr-1" />Assinado em {new Date(s.signedAt).toLocaleDateString("pt-BR")}</div>}
                </div>
                {s.status === "assinado" ? (
                  <Badge className="bg-success/15 text-success border-0 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Assinado</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => documentsStore.signBy(doc.id, s.id)}>Simular assinatura</Button>
                )}
              </div>
            ))}
          </TabsContent>
        </Tabs>
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
