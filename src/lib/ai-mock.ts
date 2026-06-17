// Motor de IA simulada — analisa dados reais (projetos/tarefas) e devolve
// insights determinísticos. Sem chamadas externas. Pronto para ser trocado
// por Lovable AI Gateway no futuro.

import type { Project, Task, User, Priority } from "./mock-data";

const PRIO_WEIGHT: Record<Priority, number> = { baixa: 1, normal: 2, alta: 3, urgente: 4, critica: 5 };

export type RiskLevel = "saudavel" | "atencao" | "risco" | "critico";

export interface ProjectInsight {
  projectId: string;
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  reasons: string[];
  summary: string;
  recommendations: string[];
  overdueCount: number;
  blockedCount: number;
  velocityPerWeek: number;
  estimatedCompletion: string | null;
  slipDays: number;
}

export interface TaskPriorityScore {
  taskId: string;
  score: number;
  reasons: string[];
}

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

const today = () => new Date().toISOString().slice(0, 10);

export function analyzeProject(project: Project, allTasks: Task[]): ProjectInsight {
  const tasks = allTasks.filter(t => t.projectId === project.id);
  const done = tasks.filter(t => t.status === "concluido");
  const open = tasks.filter(t => t.status !== "concluido");
  const overdue = open.filter(t => t.dueDate && t.dueDate < today());
  const blocked = open.filter(t => (t.dependsOn || []).some(id => {
    const dep = allTasks.find(x => x.id === id);
    return dep && dep.status !== "concluido";
  }));
  const highPriority = open.filter(t => t.priority === "urgente" || t.priority === "critica");

  // Velocity: tarefas concluídas nos últimos 14 dias
  const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const recent = done.filter(t => t.completedAt && new Date(t.completedAt) >= twoWeeksAgo);
  const velocityPerWeek = +(recent.length / 2).toFixed(1);

  // Risk score
  let score = 0;
  const reasons: string[] = [];
  if (overdue.length) { score += Math.min(35, overdue.length * 8); reasons.push(`${overdue.length} tarefa(s) atrasada(s)`); }
  if (blocked.length) { score += Math.min(20, blocked.length * 5); reasons.push(`${blocked.length} bloqueada(s) por dependências`); }
  if (highPriority.length) { score += Math.min(15, highPriority.length * 4); reasons.push(`${highPriority.length} de alta prioridade pendente(s)`); }
  if (velocityPerWeek === 0 && open.length > 0) { score += 15; reasons.push("Sem entregas nas últimas 2 semanas"); }
  if (project.endDate < today() && project.status !== "concluido") { score += 25; reasons.push("Prazo final do projeto já passou"); }
  const daysLeft = daysBetween(today(), project.endDate);
  if (daysLeft > 0 && daysLeft < 7 && project.progress < 80) { score += 10; reasons.push(`Apenas ${daysLeft}d até o prazo, progresso ${project.progress}%`); }
  if (project.health < 60) { score += 10; reasons.push(`Saúde do projeto em ${project.health}%`); }
  if (reasons.length === 0) reasons.push("Equipe entregando no ritmo planejado");

  score = Math.min(100, score);
  const riskLevel: RiskLevel = score >= 70 ? "critico" : score >= 45 ? "risco" : score >= 20 ? "atencao" : "saudavel";

  // Slip days estimado (com base na velocidade)
  let slipDays = 0;
  let estimatedCompletion: string | null = null;
  if (open.length > 0 && velocityPerWeek > 0) {
    const weeksNeeded = open.length / velocityPerWeek;
    const eta = new Date(); eta.setDate(eta.getDate() + Math.ceil(weeksNeeded * 7));
    estimatedCompletion = eta.toISOString().slice(0, 10);
    slipDays = Math.max(0, daysBetween(project.endDate, estimatedCompletion));
  }

  // Resumo
  const summary = buildProjectSummary(project, tasks, done.length, overdue.length, velocityPerWeek, daysLeft);

  // Recomendações
  const recommendations: string[] = [];
  if (overdue.length > 0) recommendations.push(`Reatribuir ou repriorizar as ${overdue.length} tarefas atrasadas com o responsável`);
  if (blocked.length > 0) recommendations.push(`Resolver as dependências bloqueadoras antes de iniciar novas frentes`);
  if (velocityPerWeek < 1 && open.length > 3) recommendations.push("Velocidade baixa — considerar revisar o escopo ou reforçar a equipe");
  if (highPriority.length > 0) recommendations.push(`Concentrar foco nas ${highPriority.length} tarefas urgentes/críticas`);
  if (slipDays > 0) recommendations.push(`Renegociar prazo: estimativa atual de atraso é de ${slipDays}d`);
  if (recommendations.length === 0) recommendations.push("Manter o ritmo. Considerar antecipar entregas se houver folga.");

  return {
    projectId: project.id, riskLevel, riskScore: score, reasons, summary, recommendations,
    overdueCount: overdue.length, blockedCount: blocked.length, velocityPerWeek,
    estimatedCompletion, slipDays,
  };
}

function buildProjectSummary(p: Project, tasks: Task[], doneCount: number, overdue: number, vel: number, daysLeft: number) {
  const total = tasks.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const parts: string[] = [];
  parts.push(`O projeto **${p.name}** está com ${pct}% das tarefas concluídas (${doneCount}/${total}).`);
  if (vel > 0) parts.push(`A equipe entrega em média **${vel} tarefa(s)/semana**.`);
  else parts.push(`Nenhuma tarefa foi concluída nas últimas 2 semanas.`);
  if (overdue > 0) parts.push(`Existem **${overdue} tarefas atrasadas** que precisam de atenção imediata.`);
  if (daysLeft > 0) parts.push(`Restam **${daysLeft} dias** até o prazo final.`);
  else if (daysLeft <= 0 && p.status !== "concluido") parts.push(`O prazo final já foi ultrapassado em ${Math.abs(daysLeft)}d.`);
  return parts.join(" ");
}

// ===== Priorização inteligente =====
export function scoreTask(task: Task, allTasks: Task[], project?: Project): TaskPriorityScore {
  const reasons: string[] = [];
  let score = 0;
  score += PRIO_WEIGHT[task.priority] * 10;
  reasons.push(`Prioridade ${task.priority} (+${PRIO_WEIGHT[task.priority] * 10})`);

  const days = daysBetween(today(), task.dueDate);
  if (days < 0) { score += 40; reasons.push(`Atrasada há ${Math.abs(days)}d (+40)`); }
  else if (days <= 1) { score += 30; reasons.push(`Vence hoje/amanhã (+30)`); }
  else if (days <= 3) { score += 20; reasons.push(`Vence em ${days}d (+20)`); }
  else if (days <= 7) { score += 10; reasons.push(`Vence em ${days}d (+10)`); }

  const deps = task.dependsOn || [];
  const blocking = allTasks.filter(t => (t.dependsOn || []).includes(task.id) && t.status !== "concluido").length;
  if (blocking > 0) { score += blocking * 8; reasons.push(`Bloqueia ${blocking} tarefa(s) (+${blocking * 8})`); }

  const blocked = deps.some(id => {
    const dep = allTasks.find(x => x.id === id);
    return dep && dep.status !== "concluido";
  });
  if (blocked) { score -= 50; reasons.push(`Aguardando dependência (-50)`); }

  if (project?.priority === "urgente" || project?.priority === "critica") {
    score += 15; reasons.push("Projeto urgente/crítico (+15)");
  }

  return { taskId: task.id, score, reasons };
}

export function getTopPriorityTasks(tasks: Task[], projects: Project[], userId?: string, limit = 5): TaskPriorityScore[] {
  const open = tasks.filter(t => t.status !== "concluido" && (!userId || t.assigneeId === userId));
  return open
    .map(t => scoreTask(t, tasks, projects.find(p => p.id === t.projectId)))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ===== Resumo semanal =====
export interface WeeklyDigest {
  rangeLabel: string;
  completed: number;
  created: number;
  overdue: number;
  topPerformers: { userId: string; count: number }[];
  highlights: string[];
}

export function buildWeeklyDigest(tasks: Task[], users: User[]): WeeklyDigest {
  const since = new Date(); since.setDate(since.getDate() - 7);
  const sinceStr = since.toISOString().slice(0, 10);
  const completed = tasks.filter(t => t.completedAt && t.completedAt >= sinceStr);
  const created = tasks.filter(t => t.createdAt >= sinceStr);
  const overdue = tasks.filter(t => t.status !== "concluido" && t.dueDate < today());

  const counts = new Map<string, number>();
  completed.forEach(t => counts.set(t.assigneeId, (counts.get(t.assigneeId) || 0) + 1));
  const topPerformers = Array.from(counts.entries())
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count).slice(0, 3);

  const highlights: string[] = [];
  highlights.push(`${completed.length} tarefas concluídas vs ${created.length} criadas nos últimos 7 dias`);
  if (overdue.length > 0) highlights.push(`Atenção: ${overdue.length} tarefa(s) em atraso no momento`);
  if (topPerformers[0]) {
    const u = users.find(u => u.id === topPerformers[0].userId);
    if (u) highlights.push(`Destaque da semana: ${u.name} (${topPerformers[0].count} entregas)`);
  }
  const ratio = created.length > 0 ? completed.length / created.length : 1;
  if (ratio < 0.7) highlights.push("Backlog crescendo mais rápido que entregas — revisar capacidade");
  else if (ratio > 1.2) highlights.push("Equipe absorvendo backlog acumulado — bom momento para planejar novos projetos");

  return {
    rangeLabel: `${since.toLocaleDateString("pt-BR")} → ${new Date().toLocaleDateString("pt-BR")}`,
    completed: completed.length, created: created.length, overdue: overdue.length,
    topPerformers, highlights,
  };
}

// ===== Assistente conversacional (mock por intent) =====
export interface AssistantContext {
  tasks: Task[];
  projects: Project[];
  users: User[];
  meId?: string;
}

export function assistantReply(question: string, ctx: AssistantContext): string {
  const q = question.toLowerCase().trim();
  if (!q) return "Pergunte sobre projetos, tarefas, riscos, prazos ou resumos.";

  // Projetos em risco
  if (/risco|crític|atras|saude|sa\u00fade/.test(q)) {
    const insights = ctx.projects.map(p => analyzeProject(p, ctx.tasks))
      .filter(i => i.riskLevel === "critico" || i.riskLevel === "risco")
      .sort((a, b) => b.riskScore - a.riskScore);
    if (insights.length === 0) return "✅ Nenhum projeto em risco no momento. Todos estão saudáveis ou em atenção leve.";
    const lines = insights.slice(0, 5).map(i => {
      const p = ctx.projects.find(p => p.id === i.projectId)!;
      return `• **${p.name}** — risco ${i.riskScore}/100 (${i.riskLevel}). ${i.reasons[0]}.`;
    });
    return `Identifiquei **${insights.length} projeto(s) em risco**:\n\n${lines.join("\n")}`;
  }

  // Próximas tarefas / o que fazer
  if (/pr[oó]xim|fazer agora|prioridade|come[cç]ar|foco/.test(q)) {
    const top = getTopPriorityTasks(ctx.tasks, ctx.projects, ctx.meId, 5);
    if (top.length === 0) return "🎉 Nenhuma tarefa pendente para você no momento!";
    const lines = top.map((t, i) => {
      const task = ctx.tasks.find(x => x.id === t.taskId)!;
      return `${i + 1}. **${task.title}** — score ${t.score} · vence ${task.dueDate}`;
    });
    return `Sua sequência ideal de execução agora:\n\n${lines.join("\n")}`;
  }

  // Resumo semanal
  if (/resumo|semana|relat[oó]rio/.test(q)) {
    const d = buildWeeklyDigest(ctx.tasks, ctx.users);
    return `**Resumo semanal** (${d.rangeLabel}):\n\n• ${d.completed} concluídas · ${d.created} criadas · ${d.overdue} atrasadas\n• ${d.highlights.join("\n• ")}`;
  }

  // Atrasadas
  if (/atras/.test(q)) {
    const overdue = ctx.tasks.filter(t => t.status !== "concluido" && t.dueDate < today());
    if (!overdue.length) return "✅ Nenhuma tarefa em atraso!";
    return `Existem **${overdue.length} tarefas em atraso**. Top 3:\n\n${overdue.slice(0, 3).map(t => `• ${t.title} (venceu em ${t.dueDate})`).join("\n")}`;
  }

  // Carga por pessoa
  if (/carga|distribuir|sobrecarga|equipe/.test(q)) {
    const load = new Map<string, number>();
    ctx.tasks.filter(t => t.status !== "concluido").forEach(t => load.set(t.assigneeId, (load.get(t.assigneeId) || 0) + 1));
    const sorted = Array.from(load.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return `Distribuição de tarefas abertas:\n\n${sorted.map(([uid, n]) => `• ${ctx.users.find(u => u.id === uid)?.name || uid}: ${n} tarefa(s)`).join("\n")}`;
  }

  // Status geral
  if (/status|geral|panorama|visão|visao/.test(q)) {
    const total = ctx.tasks.length;
    const done = ctx.tasks.filter(t => t.status === "concluido").length;
    const active = ctx.projects.filter(p => p.status === "andamento").length;
    return `**Panorama geral:**\n\n• ${active} projetos em andamento\n• ${done}/${total} tarefas concluídas (${Math.round(done/total*100)}%)\n• ${ctx.projects.length} projetos no portfólio`;
  }

  return "Posso ajudar com: **projetos em risco**, **próximas tarefas**, **resumo semanal**, **tarefas atrasadas**, **carga da equipe** ou **panorama geral**. O que prefere?";
}

export const RISK_META: Record<RiskLevel, { label: string; color: string; className: string }> = {
  saudavel: { label: "Saudável", color: "oklch(0.62 0.16 155)", className: "bg-success/15 text-success border-success/30" },
  atencao:  { label: "Atenção",  color: "oklch(0.7 0.15 70)",   className: "bg-warning/15 text-warning border-warning/30" },
  risco:    { label: "Em risco", color: "oklch(0.65 0.18 25)",  className: "bg-destructive/15 text-destructive border-destructive/30" },
  critico:  { label: "Crítico",  color: "oklch(0.55 0.22 25)",  className: "bg-destructive/25 text-destructive border-destructive/50" },
};
