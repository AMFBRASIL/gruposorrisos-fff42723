import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FolderKanban, Columns3, CheckSquare, Calendar, Users, BarChart3, Settings, Moon, Sun, Search, Bell, Plus, UserCog, FileStack, Zap, Clock, Pause, Brain } from "lucide-react";
import { AIAssistant } from "@/components/ai-assistant";
import { useTheme, themeStore, useActiveTimer, timerStore, useTasks } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { users } from "@/lib/mock-data";
import { CreateTaskWizard } from "@/components/create-task-wizard";
import { useState, useEffect, type ReactNode } from "react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projetos", label: "Projetos", icon: FolderKanban },
  { to: "/templates", label: "Templates", icon: FileStack },
  { to: "/kanban", label: "Kanban", icon: Columns3 },
  { to: "/minhas-tarefas", label: "Minhas Tarefas", icon: CheckSquare },
  { to: "/calendario", label: "Calendário", icon: Calendar },
  { to: "/timesheet", label: "Timesheet", icon: Clock },
  { to: "/automacoes", label: "Automações", icon: Zap },
  { to: "/insights", label: "IA Insights", icon: Brain },
  { to: "/equipe", label: "Equipe", icon: Users },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/perfis", label: "Perfis de Acesso", icon: UserCog },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

function TimerChip() {
  const active = useActiveTimer();
  const allTasks = useTasks();
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => force(x => x + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  if (!active) return null;
  const task = allTasks.find(t => t.id === active.taskId);
  const elapsed = Math.floor((Date.now() - new Date(active.startedAt).getTime()) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <button
      onClick={() => timerStore.stop()}
      className="hidden md:inline-flex items-center gap-2 rounded-full bg-success/10 text-success border border-success/30 px-3 h-9 text-xs font-medium hover:bg-success/15 transition-colors"
      title="Parar cronômetro"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      <span className="font-mono tabular-nums">{mm}:{ss}</span>
      <span className="max-w-[140px] truncate hidden lg:inline">{task?.title}</span>
      <Pause className="h-3 w-3" />
    </button>
  );
}

export function AppShell({ children, title, subtitle, actions, primaryAction }: { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode; primaryAction?: ReactNode }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const theme = useTheme();
  const me = users[0];
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-5 text-primary-foreground font-bold">S</div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Grupo Sorrisos</div>
            <div className="text-xs text-muted-foreground">Tasks Platform</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(item => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}>
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar className="h-9 w-9"><AvatarFallback style={{ backgroundColor: me.color, color: "white" }}>{me.initials}</AvatarFallback></Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{me.name}</div>
              <div className="text-xs text-muted-foreground truncate">{me.role}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4 md:px-8 h-16">
          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-lg font-semibold truncate">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <div className="hidden lg:flex items-center relative">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar tarefas, projetos..." className="pl-9 w-72 h-9 bg-muted/50 border-transparent focus-visible:bg-card" />
          </div>
          <TimerChip />
          {actions}
          <Button size="icon" variant="ghost" onClick={() => themeStore.toggle()} aria-label="Alternar tema">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="relative" aria-label="Notificações">
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-destructive" />
          </Button>
          {primaryAction !== undefined ? primaryAction : <Button size="sm" className="hidden sm:inline-flex" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova Tarefa</Button>}
        </header>
        <div className="flex-1 min-w-0">{children}</div>
      </main>
      <CreateTaskWizard open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
