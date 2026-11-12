import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAutomations, automationsStore } from "@/lib/store";
import { Plus, Zap, Clock, AlertTriangle, ArrowRight, Bell, Mail, Trash2, Play, GitBranch } from "lucide-react";
import { CreateAutomationWizard } from "@/components/create-automation-wizard";
import type { TriggerType, ActionType } from "@/lib/mock-data";

const triggerMeta: Record<TriggerType, { label: string; icon: any; color: string }> = {
  status_change: { label: "Mudança de status", icon: ArrowRight, color: "text-info" },
  task_created: { label: "Tarefa criada", icon: Plus, color: "text-success" },
  due_soon: { label: "Próximo do prazo", icon: Clock, color: "text-warning" },
  overdue: { label: "Atrasada", icon: AlertTriangle, color: "text-destructive" },
  assigned: { label: "Atribuição", icon: GitBranch, color: "text-primary" },
};
const actionMeta: Record<ActionType, { label: string; icon: any }> = {
  notify: { label: "Notificar", icon: Bell },
  create_task: { label: "Criar tarefa", icon: Plus },
  move_status: { label: "Mover status", icon: ArrowRight },
  set_priority: { label: "Alterar prioridade", icon: Zap },
  send_email: { label: "Enviar e-mail", icon: Mail },
  comment: { label: "Comentar", icon: Bell },
};

export const Route = createFileRoute("/automacoes")({
  head: () => ({ meta: [
    { title: "Automações — Grupo Sorrisos Tasks" },
    { name: "description", content: "Regras automáticas para acelerar fluxos repetitivos." },
    { property: "og:title", content: "Automações — Grupo Sorrisos Tasks" },
    { property: "og:description", content: "Regras automáticas para acelerar fluxos repetitivos." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: AutomacoesPage,
});

function AutomacoesPage() {
  const rules = useAutomations();
  const [open, setOpen] = useState(false);
  const active = rules.filter(r => r.enabled).length;
  const totalRuns = rules.reduce((s, r) => s + r.runs, 0);

  return (
    <AppShell
      title="Automações"
      subtitle="Reduza trabalho repetitivo com regras inteligentes"
      primaryAction={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Automação
        </Button>
      }
    >
      <div className="p-4 md:p-8 max-w-7xl space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat label="Regras ativas" value={active} hint={`${rules.length} no total`} icon={Zap} hue="from-yellow-500/20 to-amber-500/10" />
          <Stat label="Execuções no mês" value={totalRuns} hint="Tudo automatizado" icon={Play} hue="from-emerald-500/20 to-teal-500/10" />
          <Stat label="Horas economizadas" value={`~${Math.round(totalRuns * 0.15)}h`} hint="Estimativa" icon={Clock} hue="from-sky-500/20 to-blue-500/10" />
        </div>

        <div className="space-y-3">
          {rules.map(r => {
            const Tm = triggerMeta[r.trigger];
            const TIcon = Tm.icon;
            return (
              <div
                key={r.id}
                className={`group rounded-2xl border bg-card p-5 transition-all hover:shadow-md ${r.enabled ? "border-border" : "border-border/50 opacity-70"}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `color-mix(in oklab, ${r.color} 18%, transparent)`, color: r.color }}
                  >
                    <Zap className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold leading-tight">{r.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.description}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Switch checked={r.enabled} onCheckedChange={() => automationsStore.toggleRule(r.id)} />
                        <button
                          onClick={() => { if (confirm(`Remover regra "${r.name}"?`)) automationsStore.removeRule(r.id); }}
                          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="gap-1.5">
                        <TIcon className={`h-3 w-3 ${Tm.color}`} /> Quando: {Tm.label}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      {r.actions.map((a, i) => {
                        const Am = actionMeta[a.type];
                        const AIcon = Am.icon;
                        return (
                          <Badge key={i} variant="outline" className="gap-1.5">
                            <AIcon className="h-3 w-3" /> {Am.label}
                          </Badge>
                        );
                      })}
                      {r.conditions.length > 0 && (
                        <Badge variant="outline" className="text-muted-foreground">+{r.conditions.length} condição(ões)</Badge>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span>{r.runs} execuções</span>
                      {r.lastRun && <span>Última: {new Date(r.lastRun).toLocaleDateString("pt-BR")}</span>}
                      <span>Criada em {new Date(r.createdAt).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {rules.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              <Zap className="h-10 w-10 mx-auto mb-3 opacity-40" />
              Nenhuma automação criada ainda.
            </div>
          )}
        </div>
      </div>
      <CreateAutomationWizard open={open} onClose={() => setOpen(false)} />
    </AppShell>
  );
}

function Stat({ label, value, hint, icon: Icon, hue }: { label: string; value: any; hint: string; icon: any; hue: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
      <div className={`absolute inset-0 bg-gradient-to-br ${hue} opacity-60`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      </div>
    </div>
  );
}
