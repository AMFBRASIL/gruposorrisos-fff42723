import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { getUser, priorityMeta, type Project } from "@/lib/mock-data";
import { useTasks, useProjects } from "@/lib/store";
import { analyzeProject, RISK_META } from "@/lib/ai-mock";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/task-card";
import { Plus, MoreHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateProjectWizard } from "@/components/create-project-wizard";
import { useState } from "react";

export const Route = createFileRoute("/projetos")({
  head: () => ({ meta: [
    { title: "Projetos — Grupo Sorrisos Tasks" },
    { name: "description", content: "Lista de projetos ativos do Grupo Sorrisos." },
  ]}),
  component: ProjectsPage,
});

function statusLabel(s: Project["status"]) {
  return { planejamento: "Planejamento", andamento: "Em andamento", pausado: "Pausado", concluido: "Concluído" }[s];
}
function statusColor(s: Project["status"]) {
  return { planejamento: "bg-info/15 text-info", andamento: "bg-success/15 text-success", pausado: "bg-warning/15 text-warning", concluido: "bg-muted text-muted-foreground" }[s];
}

function ProjectsPage() {
  const tasks = useTasks();
  const projects = useProjects();
  const [createOpen, setCreateOpen] = useState(false);
  return (
    <AppShell title="Projetos" subtitle={`${projects.length} projetos ativos`} actions={
      <Button size="sm" className="hidden md:inline-flex" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Novo Projeto</Button>
    }>
      <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map(p => {
          const pTasks = tasks.filter(t => t.projectId === p.id);
          const completed = pTasks.filter(t => t.status === "concluido").length;
          const owner = getUser(p.ownerId);
          const insight = analyzeProject(p, tasks);
          const riskMeta = RISK_META[insight.riskLevel];
          return (
            <Card key={p.id} className="overflow-hidden border-border/60 hover:shadow-md transition-shadow p-0">
              <div className="h-2" style={{ backgroundColor: p.color }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold leading-tight">{p.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className={`text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 ${statusColor(p.status)}`}>{statusLabel(p.status)}</span>
                  <span className={`text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 ${priorityMeta[p.priority].className}`}>{priorityMeta[p.priority].label}</span>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Progresso</span><span>{p.progress}%</span>
                  </div>
                  <Progress value={p.progress} className="h-1.5" />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div><div className="text-lg font-bold">{pTasks.length}</div><div className="text-[10px] text-muted-foreground uppercase">Tarefas</div></div>
                  <div><div className="text-lg font-bold text-success">{completed}</div><div className="text-[10px] text-muted-foreground uppercase">Concluídas</div></div>
                  <div><div className="text-lg font-bold">{p.health}</div><div className="text-[10px] text-muted-foreground uppercase">Saúde</div></div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <div className="flex -space-x-2">
                    {p.teamIds.slice(0,4).map(id => <UserAvatar key={id} id={id} size={26} />)}
                    {p.teamIds.length > 4 && <div className="h-[26px] w-[26px] rounded-full bg-muted text-[10px] flex items-center justify-center border-2 border-card">+{p.teamIds.length - 4}</div>}
                  </div>
                  <span className="text-xs text-muted-foreground">{owner?.name}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-3">{p.startDate} → {p.endDate}</div>
              </div>
            </Card>
          );
        })}
      </div>
      <CreateProjectWizard open={createOpen} onClose={() => setCreateOpen(false)} />
    </AppShell>
  );
}
