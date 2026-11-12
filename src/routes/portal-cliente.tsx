import { SupplierPortal } from '@/components/supplier-portal';
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useDocuments, useInvoices, documentsStore, invoicesStore } from "@/lib/store";
import { clients, projects, tasks, getUser, invoiceTotal, formatBRL, documentTypeMeta, documentStatusMeta, invoiceStatusMeta } from "@/lib/mock-data";
import { FileText, FileSignature, DollarSign, CheckCircle2, Clock, Download, ExternalLink, Building2, MessageCircle, AlertCircle, Calendar, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/portal-cliente")({ head: () => ({ meta: [{ title: 'Portal do Cliente | Grupo Sorrisos' }, { name: 'description', content: 'Pedidos de Compras, respostas com CSV e preços, documentos e faturas do Grupo Sorrisos.' }, { property: 'og:title', content: 'Portal do Cliente | Grupo Sorrisos' }, { property: 'og:description', content: 'Responda pedidos de Compras com preços importados do CSV e acompanhe suas propostas.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }), component: PortalPage });

// Cliente visualizando seu próprio portal (demo: Hospital Vida Plena — cli4)
const CLIENT_ID = "cli4";

function PortalPage() {
  return <div className="min-h-screen bg-background text-foreground"><header className="border-b border-border bg-background"><div className="max-w-7xl mx-auto px-5 md:px-10 py-5 flex items-center gap-3"><span className="h-10 w-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold">GS</span><div><div className="font-semibold">Grupo | Sorrisos</div><div className="text-xs text-muted-foreground">Portal do Cliente · Fornecedores e parceiros</div></div></div></header><Tabs defaultValue="pedidos"><div className="max-w-7xl mx-auto px-5 md:px-10 pt-5"><TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="pedidos"><Building2 className="h-4 w-4 mr-2" />Pedidos de Compras</TabsTrigger><TabsTrigger value="conta"><FileText className="h-4 w-4 mr-2" />Projetos, documentos e faturas</TabsTrigger></TabsList></div><TabsContent value="pedidos" className="mt-0"><SupplierPortal embedded destination="/portal-cliente" /></TabsContent><TabsContent value="conta" className="mt-0"><ClientWorkspace /></TabsContent></Tabs></div>;
}

function ClientWorkspace() {
  const docs = useDocuments();
  const invs = useInvoices();
  const [selectedClient, setSelectedClient] = useState(CLIENT_ID);

  const client = useMemo(() => clients.find(c => c.id === selectedClient) ?? clients[0], [selectedClient]);
  const clientProjects = useMemo(() => projects.filter(p => tasks.some(t => t.projectId === p.id)).slice(0, 4), []);
  const clientDocs = useMemo(() => docs.filter(d => d.clientId === selectedClient && d.status !== "arquivado"), [docs, selectedClient]);
  const clientInvs = useMemo(() => invs.filter(i => i.clientId === selectedClient), [invs, selectedClient]);
  const pendingSigs = clientDocs.filter(d => d.signatories.some(s => s.email.includes(client?.name?.toLowerCase().split(" ")[0] || "") || s.status === "pendente") && d.status === "aguardando_assinatura");
  const overdue = clientInvs.filter(i => i.status === "vencida");
  const totalPaid = clientInvs.filter(i => i.status === "paga").reduce((s, i) => s + invoiceTotal(i), 0);
  const totalDue = clientInvs.filter(i => i.status === "enviada" || i.status === "vencida").reduce((s, i) => s + invoiceTotal(i), 0);

  if (!client) return null;
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-chart-5 text-white flex items-center justify-center font-bold text-xs">GS</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Grupo | Sorrisos</div>
              <div className="text-xs text-muted-foreground">Portal do Cliente</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              {clients.filter(c => c.status === "ativo").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Avatar className="h-9 w-9"><AvatarFallback style={{ backgroundColor: client.color, color: "white" }}>{client.logo}</AvatarFallback></Avatar>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Hero */}
        <div className="rounded-2xl p-8 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${client.color}, ${client.color}dd)` }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-wider opacity-80">Bem-vindo de volta</div>
              <h1 className="text-3xl font-bold mt-1">{client.name}</h1>
              <div className="flex items-center gap-2 mt-2 text-sm opacity-90">
                <Building2 className="h-4 w-4" />
                {client.city} • Cliente desde {new Date(client.since).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider opacity-80">Investimento total</div>
              <div className="text-3xl font-bold mt-1">{formatBRL(client.ltv)}</div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {(pendingSigs.length > 0 || overdue.length > 0) && (
          <div className="grid gap-3 md:grid-cols-2">
            {pendingSigs.length > 0 && (
              <Card className="p-4 border-info/40 bg-info/5">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-info/15 text-info flex items-center justify-center"><FileSignature className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{pendingSigs.length} documento{pendingSigs.length > 1 ? "s" : ""} aguardando sua assinatura</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Revise e assine para dar continuidade aos projetos.</div>
                  </div>
                </div>
              </Card>
            )}
            {overdue.length > 0 && (
              <Card className="p-4 border-destructive/40 bg-destructive/5">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center"><AlertCircle className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{overdue.length} fatura{overdue.length > 1 ? "s" : ""} em atraso</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{formatBRL(overdue.reduce((s, i) => s + invoiceTotal(i), 0))} em pendência.</div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={FileText}      label="Projetos ativos" value={String(clientProjects.length)} tone="primary" />
          <Stat icon={FileSignature} label="Documentos"      value={String(clientDocs.length)}     tone="info" />
          <Stat icon={CheckCircle2}  label="Pago no período" value={formatBRL(totalPaid)}          tone="success" />
          <Stat icon={DollarSign}    label="A receber"       value={formatBRL(totalDue)}           tone="warning" />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="projetos">
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="projetos">Projetos</TabsTrigger>
            <TabsTrigger value="documentos">Documentos ({clientDocs.length})</TabsTrigger>
            <TabsTrigger value="faturas">Faturas ({clientInvs.length})</TabsTrigger>
            <TabsTrigger value="atendimento">Atendimento</TabsTrigger>
          </TabsList>

          <TabsContent value="projetos" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              {clientProjects.map(p => {
                const projTasks = tasks.filter(t => t.projectId === p.id);
                const done = projTasks.filter(t => t.status === "concluido").length;
                const owner = getUser(p.ownerId);
                return (
                  <Card key={p.id} className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="text-sm font-semibold">{p.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px]" style={{ borderColor: p.color, color: p.color }}>{p.status}</Badge>
                    </div>
                    <Progress value={p.progress} className="h-2 mb-2" />
                    <div className="flex items-center justify-between text-xs">
                      <div className="text-muted-foreground">{done}/{projTasks.length} tarefas • {p.progress}%</div>
                      {owner && (
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5"><AvatarFallback style={{ backgroundColor: owner.color, color: "white", fontSize: 9 }}>{owner.initials}</AvatarFallback></Avatar>
                          <span className="text-muted-foreground">{owner.name.split(" ")[0]}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
              {clientProjects.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground md:col-span-2">Nenhum projeto ativo no momento.</Card>}
            </div>
          </TabsContent>

          <TabsContent value="documentos" className="mt-4 space-y-2">
            {clientDocs.map(d => {
              const tm = documentTypeMeta[d.type];
              const sm = documentStatusMeta[d.status];
              const pendingSig = d.signatories.find(s => s.status === "pendente");
              return (
                <Card key={d.id} className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: tm.color + "22" }}>{tm.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-semibold truncate">{d.title}</div>
                        <Badge className={`${sm.className} text-[10px] border-0`}>{sm.label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">v{d.versions.length} • {new Date(d.updatedAt).toLocaleDateString("pt-BR")}</div>
                    </div>
                    {d.value && <div className="text-sm font-semibold text-primary shrink-0">{formatBRL(d.value)}</div>}
                    <Button size="sm" variant="outline"><Download className="h-3.5 w-3.5 mr-1.5" />PDF</Button>
                    {pendingSig && d.status === "aguardando_assinatura" && (
                      <Button size="sm" onClick={() => documentsStore.signBy(d.id, pendingSig.id)}>
                        <FileSignature className="h-3.5 w-3.5 mr-1.5" />Assinar
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
            {clientDocs.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">Sem documentos.</Card>}
          </TabsContent>

          <TabsContent value="faturas" className="mt-4 space-y-2">
            {clientInvs.map(i => {
              const sm = invoiceStatusMeta[i.status];
              const total = invoiceTotal(i);
              return (
                <Card key={i.id} className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><DollarSign className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-semibold">{i.number}</div>
                        <Badge className={`${sm.className} text-[10px] border-0`}>{sm.label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        <Calendar className="h-3 w-3 inline mr-1" />Emitida {new Date(i.issueDate).toLocaleDateString("pt-BR")} • Vence {new Date(i.dueDate).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <div className="text-sm font-bold shrink-0">{formatBRL(total)}</div>
                    <Button size="sm" variant="outline"><Download className="h-3.5 w-3.5 mr-1.5" />NF-e</Button>
                    {(i.status === "enviada" || i.status === "vencida") && (
                      <Button size="sm" onClick={() => invoicesStore.markPaid(i.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Marcar pago
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
            {clientInvs.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">Sem faturas.</Card>}
          </TabsContent>

          <TabsContent value="atendimento" className="mt-4">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><MessageCircle className="h-5 w-5" /></div>
                <div>
                  <div className="text-sm font-semibold">Fale com seu gerente de conta</div>
                  <div className="text-xs text-muted-foreground">Respondemos em até 4 horas úteis.</div>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                {[{ icon: MessageCircle, label: "Abrir chamado",  desc: "Suporte técnico ou comercial" },
                  { icon: ExternalLink,  label: "Agendar reunião", desc: "Reserve 30 ou 60 minutos" },
                  { icon: TrendingUp,    label: "Solicitar serviço",desc: "Novo escopo ou proposta" }].map(a => (
                  <button key={a.label} className="flex flex-col items-start gap-2 p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/40 transition-all text-left">
                    <a.icon className="h-5 w-5 text-primary" />
                    <div>
                      <div className="text-sm font-semibold">{a.label}</div>
                      <div className="text-xs text-muted-foreground">{a.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-center text-xs text-muted-foreground py-4 flex items-center justify-center gap-1">
          <Clock className="h-3 w-3" /> Última sincronização há instantes • Portal seguro
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "primary"|"success"|"warning"|"info" }) {
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
