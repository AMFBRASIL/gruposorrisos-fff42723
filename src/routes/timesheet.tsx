import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useTimeEntries, useTasks } from "@/lib/store";
import { users, getProject } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock, TrendingUp, Users as UsersIcon } from "lucide-react";

export const Route = createFileRoute("/timesheet")({
  head: () => ({ meta: [
    { title: "Timesheet — Grupo Sorrisos Tasks" },
    { name: "description", content: "Acompanhe as horas registradas por colaborador e projeto." },
    { property: "og:title", content: "Timesheet — Grupo Sorrisos Tasks" },
    { property: "og:description", content: "Acompanhe as horas registradas por colaborador e projeto." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: TimesheetPage,
});

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function startOfWeek(d: Date) {
  const day = (d.getDay() + 6) % 7; // Mon=0
  const r = new Date(d); r.setDate(d.getDate() - day); r.setHours(0,0,0,0);
  return r;
}
function fmtDay(d: Date) { return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }

function TimesheetPage() {
  const entries = useTimeEntries();
  const tasks = useTasks();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const s = startOfWeek(new Date("2026-06-10"));
    s.setDate(s.getDate() + weekOffset * 7);
    return s;
  }, [weekOffset]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  }), [weekStart]);

  const weekEntries = entries.filter(e => {
    const d = new Date(e.start);
    return d >= weekStart && d < new Date(weekStart.getTime() + 7 * 86400000);
  });

  const minutesByUserDay: Record<string, Record<number, number>> = {};
  users.forEach(u => { minutesByUserDay[u.id] = {}; days.forEach((_, i) => minutesByUserDay[u.id][i] = 0); });
  weekEntries.forEach(e => {
    const d = new Date(e.start);
    const di = Math.floor((d.getTime() - weekStart.getTime()) / 86400000);
    if (di >= 0 && di < 7) minutesByUserDay[e.userId][di] = (minutesByUserDay[e.userId][di] || 0) + e.minutes;
  });
  const totalMin = weekEntries.reduce((s, e) => s + e.minutes, 0);

  // By project
  const minutesByProject: Record<string, number> = {};
  weekEntries.forEach(e => {
    const task = tasks.find(t => (t.timeEntries || []).some(te => te.id === e.id));
    const pid = task?.projectId || "—";
    minutesByProject[pid] = (minutesByProject[pid] || 0) + e.minutes;
  });
  const projectTotals = Object.entries(minutesByProject).sort((a,b) => b[1]-a[1]);

  const fmt = (m: number) => `${Math.floor(m/60)}h${String(m%60).padStart(2,"0")}`;

  return (
    <AppShell
      title="Timesheet"
      subtitle="Horas registradas por colaborador e projeto"
      primaryAction={null}
    >
      <div className="p-4 md:p-8 max-w-7xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat label="Total da semana" value={fmt(totalMin)} icon={Clock} />
          <Stat label="Colaboradores ativos" value={Object.values(minutesByUserDay).filter(d => Object.values(d).some(v => v > 0)).length} icon={UsersIcon} />
          <Stat label="Média diária" value={fmt(Math.round(totalMin/7))} icon={TrendingUp} />
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
            <Button size="sm" variant="ghost" onClick={() => setWeekOffset(o => o-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="text-sm font-semibold">
              Semana de {weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setWeekOffset(o => o+1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-5 py-2 font-semibold">Colaborador</th>
                  {days.map((d, i) => (
                    <th key={i} className="px-2 py-2 font-semibold text-center">
                      <div>{WEEKDAYS[i]}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">{fmtDay(d)}</div>
                    </th>
                  ))}
                  <th className="px-3 py-2 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const total = Object.values(minutesByUserDay[u.id]).reduce((s, v) => s + v, 0);
                  if (total === 0) return null;
                  return (
                    <tr key={u.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold" style={{ backgroundColor: u.color }}>{u.initials}</span>
                          <div>
                            <div className="font-medium">{u.name}</div>
                            <div className="text-[10px] text-muted-foreground">{u.department}</div>
                          </div>
                        </div>
                      </td>
                      {days.map((_, i) => {
                        const m = minutesByUserDay[u.id][i] || 0;
                        const intensity = Math.min(1, m / 480);
                        return (
                          <td key={i} className="px-2 py-2 text-center">
                            {m > 0 ? (
                              <span
                                className="inline-flex items-center justify-center rounded-md font-mono tabular-nums text-xs font-medium px-2 py-1"
                                style={{ background: `color-mix(in oklab, ${u.color} ${20 + intensity * 30}%, transparent)`, color: u.color }}
                              >
                                {fmt(m)}
                              </span>
                            ) : <span className="text-muted-foreground/40">—</span>}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Horas por projeto na semana</h3>
          {projectTotals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma hora registrada nesta semana.</p>
          ) : (
            <div className="space-y-2.5">
              {projectTotals.map(([pid, min]) => {
                const project = getProject(pid);
                const pct = Math.round((min / totalMin) * 100);
                return (
                  <div key={pid}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project?.color || "#999" }} />
                        <span className="font-medium">{project?.name || "Sem projeto"}</span>
                      </div>
                      <span className="font-mono tabular-nums text-muted-foreground">{fmt(min)} · {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full" style={{ width: `${pct}%`, backgroundColor: project?.color || "var(--primary)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: any; icon: any }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
