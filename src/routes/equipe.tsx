import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useTasks, useUserProfiles } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Mail, Briefcase, UserPlus } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CreateMemberWizard } from "@/components/create-member-wizard";

export const Route = createFileRoute("/equipe")({
  head: () => ({ meta: [
    { title: "Equipe — Grupo Sorrisos Tasks" },
    { name: "description", content: "Equipe e departamentos." },
  ]}),
  component: TeamPage,
});

function TeamPage() {
  const tasks = useTasks();
  const members = useUserProfiles();
  const [memberOpen, setMemberOpen] = useState(false);

  return (
    <AppShell
      title="Equipe"
      subtitle={`${members.length} colaboradores`}
      primaryAction={
        <Button size="sm" className="hidden sm:inline-flex" onClick={() => setMemberOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1" /> Novo Membro
        </Button>
      }
    >
      <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {members.map(u => {
          const my = tasks.filter(t => t.assigneeId === u.id);
          const done = my.filter(t => t.status === "concluido").length;
          const pct = my.length ? Math.round((done / my.length) * 100) : 0;
          return (
            <Card key={u.id} className="p-5 border-border/60 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <span className="h-[52px] w-[52px] rounded-full flex items-center justify-center text-white font-semibold shrink-0" style={{ backgroundColor: u.color }}>
                  {u.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate">{u.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase className="h-3 w-3" /> {u.role} • {u.department}</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {u.email}</div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div><div className="text-lg font-bold">{my.length}</div><div className="text-[10px] uppercase text-muted-foreground">Tarefas</div></div>
                <div><div className="text-lg font-bold text-success">{done}</div><div className="text-[10px] uppercase text-muted-foreground">Concluídas</div></div>
                <div><div className="text-lg font-bold">{my.length - done}</div><div className="text-[10px] uppercase text-muted-foreground">Ativas</div></div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Conclusão</span><span>{pct}%</span></div>
                <Progress value={pct} className="h-1.5" />
              </div>
            </Card>
          );
        })}
      </div>
      <CreateMemberWizard open={memberOpen} onClose={() => setMemberOpen(false)} />
    </AppShell>
  );
}
