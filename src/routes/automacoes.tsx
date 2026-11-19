import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAutomations, automationsStore } from "@/lib/store";
import { COLUMNS, priorityMeta, type Priority, type AutomationRule } from "@/lib/mock-data";
import { ArrowRight, Plus, Zap, Clock, Trash2, Play, Pencil } from "lucide-react";
import { AutomationWizard } from "@/components/create-automation-wizard";
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { actionsFor, eventById, moduleById } from "@/lib/automation-catalog";

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
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const active = rules.filter(r => r.enabled).length;
  const totalRuns = rules.reduce((s, r) => s + r.runs, 0);

  return (
    <AppShell
      title="Automações"
      subtitle="Quando algo acontece em qualquer módulo, a regra executa o próximo passo"
      primaryAction={
        <Button size="sm" onClick={() => { setEditing(null); setCreating(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova Automação
        </Button>
      }
    >
      <div className="flex h-full min-h-0 w-full flex-col gap-4 p-4 md:p-6">
        <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
          <Stat label="Regras ativas" value={active} hint={`${rules.length} no total`} icon={Zap} hue="from-yellow-500/20 to-amber-500/10" />
          <Stat label="Execuções no mês" value={totalRuns} hint="Tudo automatizado" icon={Play} hue="from-emerald-500/20 to-teal-500/10" />
          <Stat label="Horas economizadas" value={`~${Math.round(totalRuns * 0.15)}h`} hint="Estimativa" icon={Clock} hue="from-sky-500/20 to-blue-500/10" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold">Regras</h2>
              <p className="text-xs text-muted-foreground">Pedidos, compras, estoque, transferências e os demais módulos. Atraso e prazo rodam no botão executar.</p>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3 sm:p-4">
          {rules.map(r => {
            const found = eventById(r.trigger);
            const TIcon = found?.icon ?? Zap;
            const module = moduleById(r.module);
            return (
              <div
                key={r.id}
                className={`rounded-2xl border bg-card p-4 transition-all hover:shadow-md sm:p-5 ${r.enabled ? "border-border" : "border-border/50 opacity-70"}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `color-mix(in oklab, ${r.color} 18%, transparent)`, color: r.color }}
                  >
                    <Zap className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="font-semibold leading-tight break-words">{r.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.description}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Switch checked={r.enabled} onCheckedChange={() => automationsStore.toggleRule(r.id)} aria-label={r.enabled ? `Pausar ${r.name}` : `Ativar ${r.name}`} />
                        {(r.trigger === "overdue" || r.trigger === "due_soon") && (
                          <Button variant="outline" size="sm" disabled={!r.enabled} onClick={() => automationsStore.runNow(r.id)}><Play className="h-3.5 w-3.5" /> Executar</Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => { setCreating(false); setEditing(r); }}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                        <Button variant="ghost" size="icon" aria-label={`Excluir ${r.name}`} onClick={() => setRemoving({ id: r.id, name: r.name })} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="gap-1.5">{module.label}</Badge>
                      <Badge variant="secondary" className="gap-1.5">
                        <TIcon className="h-3 w-3" /> Quando: {found?.label ?? r.trigger}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      {r.actions.map((a, i) => {
                        const Am = actionsFor(r.module || "tarefas").find((item) => item.id === a.type) ?? actionsFor("tarefas").find((item) => item.id === a.type);
                        const AIcon = Am?.icon ?? Zap;
                        return (
                          <Badge key={i} variant="outline" className="gap-1.5">
                            <AIcon className="h-3 w-3" /> {Am?.label ?? a.type}{actionDetail(a.type, a.payload)}
                          </Badge>
                        );
                      })}
                      {r.conditions.length > 0 && (
                        <Badge variant="outline" className="text-muted-foreground">+{r.conditions.length} condição(ões)</Badge>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
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
            <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              <Zap className="h-10 w-10 mx-auto mb-3 opacity-40" />
              Nenhuma automação criada ainda.
            </div>
          )}
          </div>
        </div>
      </div>
      <AutomationWizard open={creating || Boolean(editing)} rule={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      <ConfirmActionDialog name={removing?.name ?? null} onClose={() => setRemoving(null)} onConfirm={() => { if (removing) automationsStore.removeRule(removing.id); }} />
    </AppShell>
  );
}

function actionDetail(type: string, payload: Record<string, string>) {
  if (type === "move_status" && payload.to) return ` → ${COLUMNS.find((column) => column.id === payload.to)?.title ?? payload.to}`;
  if (type === "set_priority" && payload.value) return ` → ${priorityMeta[payload.value as Priority]?.label ?? payload.value}`;
  if (type === "create_task" && payload.title) return ` → ${payload.title}`;
  return "";
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
        <div className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      </div>
    </div>
  );
}
