import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useApprovals, useTimeEntries, useUserProfiles, ACCESS_PAGES } from "@/lib/store";
import { useDirectory, type DirectoryUser } from "@/lib/directory";
import { useWork } from "@/lib/work-live";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CreateMemberWizard } from "@/components/create-member-wizard";
import { Briefcase, Clock3, LogIn, Mail, MapPin, Pencil, Ticket, UserPlus } from "lucide-react";

export const Route = createFileRoute("/equipe")({
  head: () => ({ meta: [
    { title: "Equipe — Grupo Sorrisos Tasks" },
    { name: "description", content: "Equipe e departamentos." },
    { property: "og:title", content: "Equipe — Grupo Sorrisos Tasks" },
    { property: "og:description", content: "Equipe e departamentos." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: TeamPage,
});

function TeamPage() {
  const tasks = useWork().tasks;
  const members = useUserProfiles();
  const directory = useDirectory();
  const approvals = useApprovals();
  const entries = useTimeEntries();
  const [memberOpen, setMemberOpen] = useState(false);
  const [editing, setEditing] = useState<DirectoryUser | null>(null);

  const statsByUser = useMemo(() => {
    const map = new Map<string, {
      tasks: number;
      done: number;
      active: number;
      tickets: number;
      accesses: number;
      hours: number;
      pages: number;
    }>();

    for (const member of members) {
      const mine = tasks.filter((task) => task.assigneeId === member.id);
      const done = mine.filter((task) => task.status === "concluido").length;
      const tickets = approvals.filter((request) => {
        if (request.status !== "pendente") return false;
        if (request.requesterId === member.id) return true;
        return request.steps.some((step) => step.status === "pendente" && step.approverId === member.id);
      }).length;
      const accesses = directory.audit.filter((row) => row.userId === member.id).length;
      const hours = entries
        .filter((entry) => entry.userId === member.id)
        .reduce((sum, entry) => sum + (entry.minutes || 0), 0) / 60;
      map.set(member.id, {
        tasks: mine.length,
        done,
        active: mine.length - done,
        tickets,
        accesses,
        hours: Math.round(hours * 10) / 10,
        pages: ACCESS_PAGES.filter((page) => member.access[page]).length,
      });
    }
    return map;
  }, [members, tasks, approvals, directory.audit, entries]);

  const openCreate = () => {
    setEditing(null);
    setMemberOpen(true);
  };

  const openEdit = (id: string) => {
    const user = directory.users.find((item) => item.id === id) ?? null;
    setEditing(user);
    setMemberOpen(true);
  };

  const closeWizard = () => {
    setMemberOpen(false);
    setEditing(null);
  };

  return (
    <AppShell
      title="Equipe"
      subtitle={`${members.length} colaboradores`}
      primaryAction={
        <Button size="sm" className="hidden sm:inline-flex" onClick={openCreate}>
          <UserPlus className="h-4 w-4 mr-1" /> Novo Membro
        </Button>
      }
    >
      <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {members.map((user) => {
          const stats = statsByUser.get(user.id) ?? { tasks: 0, done: 0, active: 0, tickets: 0, accesses: 0, hours: 0, pages: 0 };
          const pct = stats.tasks ? Math.round((stats.done / stats.tasks) * 100) : 0;
          return (
            <Card key={user.id} className="p-5 border-border/60 hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-start gap-3">
                <span className="h-[52px] w-[52px] rounded-full flex items-center justify-center text-white font-semibold shrink-0" style={{ backgroundColor: user.color }}>
                  {user.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold truncate">{user.name}</h3>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Editar ${user.name}`} onClick={() => openEdit(user.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase className="h-3 w-3" /> {user.role} • {user.department}</p>
                  <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {user.branch || "Sem filial"}</p>
                </div>
              </div>

              <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {user.email}</div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">{stats.pages} páginas</Badge>
                {stats.tickets > 0 && <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">{stats.tickets} ticket{stats.tickets === 1 ? "" : "s"}</Badge>}
                {stats.active > 0 && <Badge variant="outline" className="text-[10px]">{stats.active} tarefa{stats.active === 1 ? "" : "s"} ativa{stats.active === 1 ? "" : "s"}</Badge>}
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat icon={LogIn} label="Acessos" value={String(stats.accesses)} />
                <Stat icon={Ticket} label="Tickets" value={String(stats.tickets)} tone={stats.tickets ? "warn" : undefined} />
                <Stat icon={Briefcase} label="Tarefas" value={String(stats.tasks)} />
                <Stat icon={Clock3} label="Horas" value={String(stats.hours)} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div><div className="text-lg font-bold">{stats.tasks}</div><div className="text-[10px] uppercase text-muted-foreground">Tarefas</div></div>
                <div><div className="text-lg font-bold text-success">{stats.done}</div><div className="text-[10px] uppercase text-muted-foreground">Concluídas</div></div>
                <div><div className="text-lg font-bold">{stats.active}</div><div className="text-[10px] uppercase text-muted-foreground">Ativas</div></div>
              </div>

              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Conclusão</span><span>{pct}%</span></div>
                <Progress value={pct} className="h-1.5" />
              </div>

              <div className="mt-4 pt-3 border-t border-border/60">
                <Button variant="outline" size="sm" className="w-full" onClick={() => openEdit(user.id)}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar membro
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <CreateMemberWizard open={memberOpen} member={editing} onClose={closeWizard} />
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof LogIn; label: string; value: string; tone?: "warn" }) {
  return (
    <div className={`rounded-xl border px-2.5 py-2 ${tone === "warn" ? "border-warning/30 bg-warning/5" : "border-border/70 bg-muted/20"}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
