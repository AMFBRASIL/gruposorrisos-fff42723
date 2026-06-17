import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useDeals, useClients, dealsStore } from "@/lib/store";
import { DEAL_STAGES, getUser, formatBRL, type DealStage, type Deal } from "@/lib/mock-data";
import { Plus, TrendingUp, Trophy, Target, Calendar, GripVertical } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/comercial")({ component: ComercialPage });

function ComercialPage() {
  const deals = useDeals();
  const clients = useClients();
  const [dragId, setDragId] = useState<string | null>(null);

  const byStage = useMemo(() => {
    const m: Record<DealStage, Deal[]> = { lead: [], qualificacao: [], proposta: [], negociacao: [], ganho: [], perdido: [] };
    deals.forEach(d => m[d.stage].push(d));
    return m;
  }, [deals]);

  const totals = useMemo(() => {
    const open = deals.filter(d => d.stage !== "ganho" && d.stage !== "perdido");
    const ganho = deals.filter(d => d.stage === "ganho");
    const perdido = deals.filter(d => d.stage === "perdido");
    const winRate = (ganho.length + perdido.length) ? Math.round((ganho.length / (ganho.length + perdido.length)) * 100) : 0;
    return {
      pipelineValue: open.reduce((s, d) => s + d.value, 0),
      pipelineWeighted: open.reduce((s, d) => s + d.value * (d.probability / 100), 0),
      ganhoValue: ganho.reduce((s, d) => s + d.value, 0),
      ticketMedio: ganho.length ? ganho.reduce((s, d) => s + d.value, 0) / ganho.length : 0,
      winRate,
      openCount: open.length,
    };
  }, [deals]);

  const onDragStart = (id: string) => setDragId(id);
  const onDrop = (stage: DealStage) => {
    if (dragId) dealsStore.moveStage(dragId, stage);
    setDragId(null);
  };

  return (
    <AppShell title="Comercial" subtitle="Pipeline de oportunidades" primaryAction={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Oportunidade</Button>}>
      <div className="p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Pipeline aberto" value={formatBRL(totals.pipelineValue)} sub={`${totals.openCount} negócios`} icon={Target} tone="primary" />
          <Stat label="Pipeline ponderado" value={formatBRL(totals.pipelineWeighted)} sub="por probabilidade" icon={TrendingUp} tone="info" />
          <Stat label="Ganho (período)" value={formatBRL(totals.ganhoValue)} sub="receita fechada" icon={Trophy} tone="success" />
          <Stat label="Ticket médio" value={formatBRL(totals.ticketMedio)} icon={TrendingUp} tone="warning" />
          <Stat label="Win rate" value={`${totals.winRate}%`} sub="ganho ÷ ganho+perdido" icon={Trophy} tone="success" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
          {DEAL_STAGES.map(stage => {
            const list = byStage[stage.id];
            const value = list.reduce((s, d) => s + d.value, 0);
            return (
              <div
                key={stage.id}
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDrop(stage.id)}
                className="flex flex-col min-h-[400px] rounded-xl bg-muted/40 border border-border"
              >
                <div className="p-3 border-b border-border" style={{ borderTopColor: stage.color, borderTopWidth: 3, borderTopStyle: "solid", borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm">{stage.title}</div>
                    <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{formatBRL(value)}</div>
                </div>
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {list.map(d => {
                    const client = clients.find(c => c.id === d.clientId);
                    const owner = getUser(d.ownerId);
                    return (
                      <Card
                        key={d.id}
                        draggable
                        onDragStart={() => onDragStart(d.id)}
                        className={`p-3 cursor-grab hover:shadow-md transition-all group ${dragId === d.id ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <GripVertical className="h-3 w-3 text-muted-foreground/40 mt-0.5 group-hover:text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium leading-snug line-clamp-2">{d.title}</div>
                            {client && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{client.name}</div>}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-sm text-primary">{formatBRL(d.value)}</div>
                          {owner && <Avatar className="h-5 w-5"><AvatarFallback style={{ backgroundColor: owner.color, color: "white", fontSize: 9 }}>{owner.initials}</AvatarFallback></Avatar>}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60 text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" /> {new Date(d.expectedCloseDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</div>
                          <div>{d.probability}%</div>
                        </div>
                      </Card>
                    );
                  })}
                  {list.length === 0 && <div className="text-[10px] text-muted-foreground text-center py-8">Arraste oportunidades aqui</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub?: string; icon: any; tone: "primary" | "success" | "info" | "warning" }) {
  const bg = { primary: "bg-primary/10 text-primary", success: "bg-success/10 text-success", info: "bg-info/10 text-info", warning: "bg-warning/10 text-warning" }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`h-7 w-7 rounded-md flex items-center justify-center ${bg}`}><Icon className="h-3.5 w-3.5" /></div>
      </div>
      <div className="text-lg font-bold">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}
