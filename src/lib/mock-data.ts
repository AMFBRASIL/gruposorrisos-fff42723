export type Priority = "baixa" | "normal" | "alta" | "urgente" | "critica";
export type TaskStatus = string;

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  initials: string;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  teamIds: string[];
  startDate: string;
  endDate: string;
  status: "planejamento" | "andamento" | "pausado" | "concluido";
  color: string;
  priority: Priority;
  progress: number;
  health: number;
}

export interface ChecklistItem { id: string; text: string; done: boolean; doneAt?: string; doneBy?: string; doneNote?: string; }
export interface Comment { id: string; userId: string; text: string; at: string; }

export interface TimeEntry { id: string; userId: string; start: string; end?: string; minutes: number; note?: string; }

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  assigneeId: string;
  participantIds: string[];
  department: string;
  tags: string[];
  priority: Priority;
  status: TaskStatus;
  createdAt: string;
  startDate: string;
  dueDate: string;
  completedAt?: string;
  checklist: ChecklistItem[];
  comments: Comment[];
  attachments: { id: string; name: string; size: string; type: string }[];
  estimatedHours: number;
  loggedHours: number;
  dependsOn?: string[];
  timeEntries?: TimeEntry[];
}

// ===== Project Templates =====
export interface TemplateTask {
  title: string;
  department?: string;
  priority?: Priority;
  estimatedHours?: number;
  offsetStartDays?: number; // dias após o início do projeto
  offsetDueDays?: number;
  status?: TaskStatus;
  dependsOnIndex?: number[]; // referência por índice dentro do template
}
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  color: string;
  category: "Operações" | "Marketing" | "TI" | "RH" | "Financeiro" | "Geral";
  defaultDurationDays: number;
  tasks: TemplateTask[];
}

// ===== Automações =====
export type TriggerType = "status_change" | "task_created" | "due_soon" | "overdue" | "assigned";
export type ActionType = "notify" | "create_task" | "move_status" | "set_priority" | "send_email" | "comment";

export interface AutomationCondition { field: string; op: "eq" | "neq" | "contains"; value: string; }
export interface AutomationAction { type: ActionType; payload: Record<string, string>; }

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: TriggerType;
  triggerConfig: Record<string, string>;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  runs: number;
  lastRun?: string;
  createdAt: string;
  color: string;
}

export const COLUMNS: { id: string; title: string }[] = [
  { id: "backlog", title: "Backlog" },
  { id: "todo", title: "A Fazer" },
  { id: "analise", title: "Em Análise" },
  { id: "dev", title: "Em Desenvolvimento" },
  { id: "aprovacao", title: "Em Aprovação" },
  { id: "concluido", title: "Concluído" },
];

export const users: User[] = [
  { id: "u1", name: "Maria Silva", email: "maria@gruposorrisos.com", role: "Gerente", department: "Operações", initials: "MS", color: "oklch(0.65 0.18 25)" },
  { id: "u2", name: "João Pereira", email: "joao@gruposorrisos.com", role: "Diretor", department: "Diretoria", initials: "JP", color: "oklch(0.6 0.18 260)" },
  { id: "u3", name: "Ana Costa", email: "ana@gruposorrisos.com", role: "Supervisora", department: "Financeiro", initials: "AC", color: "oklch(0.62 0.16 155)" },
  { id: "u4", name: "Carlos Lima", email: "carlos@gruposorrisos.com", role: "Colaborador", department: "TI", initials: "CL", color: "oklch(0.65 0.14 230)" },
  { id: "u5", name: "Beatriz Souza", email: "beatriz@gruposorrisos.com", role: "Colaboradora", department: "Marketing", initials: "BS", color: "oklch(0.7 0.18 340)" },
  { id: "u6", name: "Rafael Mendes", email: "rafael@gruposorrisos.com", role: "Colaborador", department: "RH", initials: "RM", color: "oklch(0.7 0.15 70)" },
  { id: "u7", name: "Patrícia Alves", email: "patricia@gruposorrisos.com", role: "Supervisora", department: "Comercial", initials: "PA", color: "oklch(0.6 0.2 295)" },
  { id: "u8", name: "Lucas Ferreira", email: "lucas@gruposorrisos.com", role: "Colaborador", department: "Operações", initials: "LF", color: "oklch(0.65 0.15 190)" },
];

export const projects: Project[] = [
  { id: "p1", name: "Implantação Unidade Sorocaba", description: "Abertura completa da nova unidade do Grupo Sorrisos em Sorocaba.", ownerId: "u2", teamIds: ["u1","u3","u4","u8"], startDate: "2026-05-01", endDate: "2026-08-30", status: "andamento", color: "oklch(0.6 0.18 260)", priority: "alta", progress: 62, health: 84 },
  { id: "p2", name: "Campanha Sorriso 2026", description: "Campanha de marketing institucional para o segundo semestre.", ownerId: "u5", teamIds: ["u5","u7"], startDate: "2026-06-01", endDate: "2026-07-15", status: "andamento", color: "oklch(0.7 0.18 340)", priority: "normal", progress: 38, health: 71 },
  { id: "p3", name: "Atualização Sistema Financeiro", description: "Migração para nova versão do ERP financeiro.", ownerId: "u3", teamIds: ["u3","u4"], startDate: "2026-04-15", endDate: "2026-06-20", status: "andamento", color: "oklch(0.62 0.16 155)", priority: "urgente", progress: 78, health: 58 },
  { id: "p4", name: "Treinamento Equipe Clínica", description: "Capacitação dos novos dentistas e auxiliares.", ownerId: "u6", teamIds: ["u6","u1"], startDate: "2026-06-05", endDate: "2026-06-25", status: "planejamento", color: "oklch(0.7 0.15 70)", priority: "normal", progress: 12, health: 90 },
  { id: "p5", name: "Auditoria LGPD", description: "Revisão completa de conformidade com a LGPD.", ownerId: "u4", teamIds: ["u4","u3","u2"], startDate: "2026-03-01", endDate: "2026-06-12", status: "andamento", color: "oklch(0.65 0.14 230)", priority: "critica", progress: 85, health: 45 },
];

const today = new Date("2026-06-10");
const addDays = (d: number) => {
  const x = new Date(today); x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};

let tid = 0;
const makeTask = (t: Partial<Task>): Task => {
  tid++;
  return {
    id: `t${tid}`,
    title: t.title || "Tarefa",
    description: t.description || "",
    projectId: t.projectId || "p1",
    assigneeId: t.assigneeId || "u1",
    participantIds: t.participantIds || [],
    department: t.department || "Operações",
    tags: t.tags || [],
    priority: t.priority || "normal",
    status: t.status || "todo",
    createdAt: t.createdAt || addDays(-10),
    startDate: t.startDate || addDays(-5),
    dueDate: t.dueDate || addDays(5),
    completedAt: t.completedAt,
    checklist: t.checklist || [],
    comments: t.comments || [],
    attachments: t.attachments || [],
    estimatedHours: t.estimatedHours ?? 8,
    loggedHours: t.loggedHours ?? 0,
  };
};

export const tasks: Task[] = [
  makeTask({ title: "Negociar contrato de locação", description: "Fechar contrato com a imobiliária da unidade Sorocaba.", projectId: "p1", assigneeId: "u1", participantIds: ["u2"], department: "Operações", tags: ["contrato","jurídico"], priority: "alta", status: "dev", dueDate: addDays(2), estimatedHours: 16, loggedHours: 10,
    checklist: [{id:"c1",text:"Revisar minuta",done:true},{id:"c2",text:"Validar com jurídico",done:true},{id:"c3",text:"Assinatura digital",done:false}],
    comments: [{id:"cm1",userId:"u2",text:"Pessoal, prioridade máxima essa semana.",at:addDays(-1)}],
  }),
  makeTask({ title: "Definir layout da recepção", projectId: "p1", assigneeId: "u8", department: "Operações", tags: ["design"], priority: "normal", status: "analise", dueDate: addDays(7), estimatedHours: 12, loggedHours: 4 }),
  makeTask({ title: "Comprar mobiliário das salas clínicas", projectId: "p1", assigneeId: "u1", department: "Compras", tags: ["compras"], priority: "alta", status: "todo", dueDate: addDays(10), estimatedHours: 20 }),
  makeTask({ title: "Contratar equipe de limpeza", projectId: "p1", assigneeId: "u6", department: "RH", priority: "normal", status: "backlog", dueDate: addDays(20) }),
  makeTask({ title: "Vistoria final da obra", projectId: "p1", assigneeId: "u2", department: "Diretoria", priority: "urgente", status: "todo", dueDate: addDays(-1), estimatedHours: 6 }),

  makeTask({ title: "Briefing da campanha", projectId: "p2", assigneeId: "u5", department: "Marketing", tags: ["criação"], priority: "normal", status: "concluido", dueDate: addDays(-15), completedAt: addDays(-12), estimatedHours: 8, loggedHours: 9 }),
  makeTask({ title: "Produzir vídeos institucionais", projectId: "p2", assigneeId: "u5", participantIds: ["u7"], department: "Marketing", tags: ["vídeo"], priority: "alta", status: "dev", dueDate: addDays(4), estimatedHours: 40, loggedHours: 22 }),
  makeTask({ title: "Programar anúncios redes sociais", projectId: "p2", assigneeId: "u7", department: "Marketing", priority: "normal", status: "todo", dueDate: addDays(8) }),

  makeTask({ title: "Backup completo do ERP atual", projectId: "p3", assigneeId: "u4", department: "TI", priority: "critica", status: "concluido", dueDate: addDays(-8), completedAt: addDays(-8) }),
  makeTask({ title: "Migrar plano de contas", projectId: "p3", assigneeId: "u3", department: "Financeiro", priority: "urgente", status: "aprovacao", dueDate: addDays(1), estimatedHours: 24, loggedHours: 23 }),
  makeTask({ title: "Treinar usuários no novo sistema", projectId: "p3", assigneeId: "u3", participantIds:["u6"], department: "Financeiro", priority: "alta", status: "todo", dueDate: addDays(12) }),
  makeTask({ title: "Configurar integrações bancárias", projectId: "p3", assigneeId: "u4", department: "TI", priority: "alta", status: "dev", dueDate: addDays(3), estimatedHours: 16, loggedHours: 7 }),

  makeTask({ title: "Montar grade de treinamento", projectId: "p4", assigneeId: "u6", department: "RH", priority: "normal", status: "analise", dueDate: addDays(6) }),
  makeTask({ title: "Reservar auditório", projectId: "p4", assigneeId: "u6", department: "RH", priority: "baixa", status: "backlog", dueDate: addDays(14) }),

  makeTask({ title: "Mapear dados pessoais coletados", projectId: "p5", assigneeId: "u4", participantIds:["u3"], department: "TI", tags: ["LGPD","conformidade"], priority: "critica", status: "dev", dueDate: addDays(-2), estimatedHours: 30, loggedHours: 26 }),
  makeTask({ title: "Atualizar política de privacidade", projectId: "p5", assigneeId: "u2", department: "Jurídico", priority: "urgente", status: "aprovacao", dueDate: addDays(0), estimatedHours: 10, loggedHours: 8 }),
  makeTask({ title: "Treinar equipe sobre LGPD", projectId: "p5", assigneeId: "u6", department: "RH", priority: "alta", status: "todo", dueDate: addDays(9) }),
  makeTask({ title: "Auditoria final", projectId: "p5", assigneeId: "u2", department: "Diretoria", priority: "critica", status: "backlog", dueDate: addDays(15) }),
];

export const priorityMeta: Record<Priority, { label: string; className: string }> = {
  baixa:    { label: "Baixa",    className: "bg-muted text-muted-foreground" },
  normal:   { label: "Normal",   className: "bg-info/15 text-info" },
  alta:     { label: "Alta",     className: "bg-warning/15 text-warning" },
  urgente:  { label: "Urgente",  className: "bg-destructive/15 text-destructive" },
  critica:  { label: "Crítica",  className: "bg-destructive text-destructive-foreground" },
};

export const getUser = (id: string) => users.find(u => u.id === id);
export const getProject = (id: string) => projects.find(p => p.id === id);

export function daysUntil(dateStr: string): number {
  const d = new Date(dateStr).getTime();
  const t = today.getTime();
  return Math.round((d - t) / 86400000);
}

export interface Activity { id: string; user: string; action: string; target: string; at: string; }
export const recentActivity: Activity[] = [
  { id: "a1", user: "Maria Silva", action: "concluiu a tarefa", target: "Briefing da campanha", at: "há 2h" },
  { id: "a2", user: "João Pereira", action: "comentou em", target: "Negociar contrato de locação", at: "há 4h" },
  { id: "a3", user: "Carlos Lima", action: "moveu para Em Desenvolvimento", target: "Configurar integrações bancárias", at: "há 6h" },
  { id: "a4", user: "Ana Costa", action: "criou a tarefa", target: "Migrar plano de contas", at: "ontem" },
  { id: "a5", user: "Beatriz Souza", action: "anexou arquivo em", target: "Produzir vídeos institucionais", at: "ontem" },
];
