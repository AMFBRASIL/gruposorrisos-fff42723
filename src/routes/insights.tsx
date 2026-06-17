import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useTasks, useProjects } from "@/lib/store";
import { users, getUser, priorityMeta } from "@/lib/mock-data";
import { analyzeProject, getTopPriorityTasks, buildWeeklyDigest, RISK_META, type ProjectInsight } from "@/lib/ai-mock";
import { UserAvatar } from "@/components/task-card";
import { Sparkles, AlertTriangle, TrendingUp, Brain, ListChecks, Zap, Calendar, Trophy, Target, ArrowUpRight } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/insights")({
  head: () => ({ meta: [
    { title: "IA Insights — Grupo Sorrisos Tasks" },
    { name: "description", content: "Insights gerados por IA: riscos, prioridades inteligentes e resumos semanais." },
  ]}),
  component: InsightsPage,
});

function InsightsPage() {
  const tasks = useTasks();
  const projects = useProjects();

  const insights = useMemo(
    () => projects.map(p => analyzeProject(p, tasks)).sort((a, b) => b.riskScore - a.riskScore),
    [projects, tasks]
  );
  const topPriority = useMemo(() => getTopPriorityTasks(tasks, projects, undefined, 6), [tasks, projects]);
  const digest = useMemo(() => buildWeeklyDigest(tasks, users), [tasks]);
  const critical = insights.filter(i => i.riskLevel === "critico" || i.riskLevel === "risco");
  const healthy = insights.filter(i => i.riskLevel === "saudavel").length;

  return (
    <AppShell
      title="IA Insights"
      subtitle="Análises e recomendações geradas automaticamente a partir dos seus dados"
      primaryAction={null}
    >
      <div className="p-4 md:p-8 space-y-8">

        {/* HERO */}
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-chart-5/10 to-transparent p-6 md:p-8">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="relative flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-chart-5 flex items-center justify-center text-primary-foreground shadow-lg shrink-0">
              <Brain className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-xs text-primary font-medium uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5" /> Análise automática
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mt-1 tracking-tight">Visão geral inteligente</h2>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
                Analisei <strong className="text-foreground">{projects.length} projetos</strong> e <strong className="text-foreground">{tasks.length} tarefas</strong>.
                {critical.length > 0 ? ` Encontrei ${critical.length} projeto(s) que precisam de atenção imediata.` : " Tudo parece saudável no momento."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Metric icon={Target} label="Saudáveis" value={healthy} tone="success" />
                <Metric icon={AlertTriangle} label="Em risco" value={critical.length} tone="destructive" />
                <Metric icon={TrendingUp} label="Velocidade média" value={`${(insights.reduce((s, i) => s + i.velocityPerWeek, 0) / Math.max(1, insights.length)).toFixed(1)}/sem`} tone="info" />
                <Metric icon={ListChecks} label="Tarefas abertas" value={tasks.filter(t => t.status !== "concluido").length} tone="muted" />
              </div>
            </div>
          </div>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* RISCOS — col 2 */}
          <Card className="lg:col-span-2 p-6 border-border/60">
            <SectionHeader icon={AlertTriangle} title="Detecção de risco" subtitle="Projetos ranqueados por probabilidade de atraso" tone="destructive" />
            <div className="space-y-3 mt-5">
              {insights.slice(0, 6).map(i => <ProjectInsightCard key={i.projectId} insight={i} projectName={projects.find(p => p.id === i.projectId)?.name || "—"} />)}
            </div>
          </Card>

          {/* RESUMO SEMANAL */}
          <Card className="p-6 border-border/60">
            <SectionHeader icon={Calendar} title="Resumo semanal" subtitle={digest.rangeLabel} tone="primary" />
            <div className="grid grid-cols-3 gap-2 mt-5">
              <Stat label="Concluídas" value={digest.completed} tone="success" />
              <Stat label="Criadas" value={digest.created} tone="info" />
              <Stat label="Atrasadas" value={digest.overdue} tone="destructive" />
            </div>
            <div className="mt-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
                <Trophy className="h-3.5 w-3.5" /> Destaques da semana
              </div>
              <div className="space-y-2">
                {digest.topPerformers.map((p, i) => {
                  const u = getUser(p.userId);
                  if (!u) return null;
                  const medals = ["🥇", "🥈", "🥉"];
                  return (
                    <div key={p.userId} className="flex items-center gap-2.5 rounded-lg bg-muted/40 p-2">
                      <span className="text-lg">{medals[i]}</span>
                      <UserAvatar id={p.userId} size={28} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.name}</div>
                        <div className="text-[11px] text-muted-foreground">{u.department}</div>
                      </div>
                      <Badge variant="secondary" className="font-mono">{p.count}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {digest.highlights.map((h, i) => (
                <div key={i} className="text-xs text-muted-foreground flex items-start gap-2 leading-relaxed">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* PRIORIZAÇÃO INTELIGENTE */}
        <Card className="p-6 border-border/60">
          <SectionHeader icon={Zap} title="Priorização inteligente" subtitle="Sequência ideal de execução baseada em prazo, prioridade e dependências" tone="warning" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-5">
            {topPriority.map((tp, idx) => {
              const task = tasks.find(t => t.id === tp.taskId)!;
              const project = projects.find(p => p.id === task.projectId);
              const user = getUser(task.assigneeId);
              return (
                <div key={tp.taskId} className="group relative rounded-xl border-2 border-border bg-card/40 p-4 hover:border-primary/50 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      <span className="h-5 w-5 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-[10px]">{idx + 1}</span>
                      Score {tp.score}
                    </div>
                    <span className={`text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 ${priorityMeta[task.priority].className}`}>{priorityMeta[task.priority].label}</span>
                  </div>
                  <div className="font-medium text-sm line-clamp-2 mb-2">{task.title}</div>
                  {project && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-3">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
                      {project.name}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2.5">
                    <div className="flex items-center gap-1.5">
                      {user && <UserAvatar id={user.id} size={20} />}
                      <span className="truncate max-w-[100px]">{user?.name.split(" ")[0]}</span>
                    </div>
                    <span>📅 {task.dueDate}</span>
                  </div>
                  <div className="mt-2.5 space-y-0.5">
                    {tp.reasons.slice(0, 2).map((r, i) => (
                      <div key={i} className="text-[10px] text-muted-foreground/80 flex items-start gap-1">
                        <ArrowUpRight className="h-2.5 w-2.5 mt-0.5 shrink-0 text-primary" /> {r}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function ProjectInsightCard({ insight, projectName }: { insight: ProjectInsight; projectName: string }) {
  const meta = RISK_META[insight.riskLevel];
  return (
    <div className={`rounded-xl border-2 p-4 ${meta.className}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm truncate text-foreground">{projectName}</h4>
            <Badge className={`${meta.className} text-[10px] border`}>{meta.label}</Badge>
          </div>
          <div className="text-xs text-foreground/80 leading-relaxed line-clamp-2">
            {insight.summary.replace(/\*\*(.*?)\*\*/g, "$1")}
          </div>
        </div>
        <div className="text-center shrink-0">
          <div className="text-2xl font-bold tabular-nums text-foreground">{insight.riskScore}</div>
          <div className="text-[9px] uppercase tracking-wider text-foreground/60">Risco</div>
        </div>
      </div>
      <Progress value={insight.riskScore} className="h-1.5 mb-3" />
      <div className="grid grid-cols-3 gap-2 text-center text-[10px] mb-3">
        <div className="rounded bg-background/50 p-1.5">
          <div className="font-bold text-foreground tabular-nums">{insight.overdueCount}</div>
          <div className="text-foreground/60 uppercase">Atrasadas</div>
        </div>
        <div className="rounded bg-background/50 p-1.5">
          <div className="font-bold text-foreground tabular-nums">{insight.blockedCount}</div>
          <div className="text-foreground/60 uppercase">Bloqueadas</div>
        </div>
        <div className="rounded bg-background/50 p-1.5">
          <div className="font-bold text-foreground tabular-nums">{insight.velocityPerWeek}</div>
          <div className="text-foreground/60 uppercase">/semana</div>
        </div>
      </div>
      <div className="space-y-1">
        {insight.recommendations.slice(0, 2).map((r, i) => (
          <div key={i} className="text-[11px] text-foreground/85 flex items-start gap-1.5">
            <Sparkles className="h-3 w-3 text-primary mt-0.5 shrink-0" /> {r}
          </div>
        ))}
      </div>
    </div>
  );
}

const TONE_BG: Record<string, string> = {
  success: "bg-success/15 text-success",
  destructive: "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
  info: "bg-info/15 text-info",
  primary: "bg-primary/15 text-primary",
  muted: "bg-muted text-muted-foreground",
};
const TONE_STAT: Record<string, string> = {
  success: "bg-success/10 text-success",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
};
const TONE_PILL: Record<string, string> = {
  success: "bg-success/15 text-success border-success/30",
  destructive: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-info/15 text-info border-info/30",
  muted: "bg-muted text-muted-foreground border-border",
};

function SectionHeader({ icon: Icon, title, subtitle, tone }: { icon: typeof Brain; title: string; subtitle: string; tone: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${TONE_BG[tone] || TONE_BG.primary}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg p-3 text-center ${TONE_STAT[tone] || TONE_STAT.info}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Brain; label: string; value: number | string; tone: string }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${TONE_PILL[tone] || TONE_PILL.muted}`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="font-semibold">{value}</span>
      <span className="opacity-75">{label}</span>
    </div>
  );
}
