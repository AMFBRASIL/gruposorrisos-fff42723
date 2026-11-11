import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FolderKanban, Columns3, CheckSquare, Calendar, Users, BarChart3, Settings, Moon, Sun, Search, Bell, Plus, UserCog, FileStack, Zap, Clock, Pause, Brain, Building2, Target, DollarSign, FileText, ShieldCheck, Globe, PanelLeftClose, PanelLeft, Menu, ChevronDown, Warehouse, Package, ArrowLeftRight, Truck, CalendarClock } from "lucide-react";
import { AIAssistant } from "@/components/ai-assistant";
import { useTheme, themeStore, useActiveTimer, timerStore, useTasks } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { users } from "@/lib/mock-data";
import { CreateTaskWizard } from "@/components/create-task-wizard";
import { useState, useEffect, useRef, type ReactNode } from "react";

const navGroups = [
  {
    label: "Principal",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/projetos", label: "Projetos", icon: FolderKanban },
      { to: "/templates", label: "Templates", icon: FileStack },
      { to: "/kanban", label: "Kanban", icon: Columns3 },
      { to: "/minhas-tarefas", label: "Minhas Tarefas", icon: CheckSquare },
      { to: "/calendario", label: "Calendário", icon: Calendar },
      { to: "/timesheet", label: "Timesheet", icon: Clock },
    ],
  },
  {
    label: "Estoque",
    items: [
      { to: "/estoque", label: "Visão Geral", icon: Warehouse },
      { to: "/materiais", label: "Materiais e Produtos", icon: Package },
      { to: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
      { to: "/transferencias", label: "Transferências", icon: Truck },
      { to: "/lotes-validades", label: "Lotes e Validades", icon: CalendarClock },
    ],
  },
  {
    label: "Automação & IA",
    items: [
      { to: "/automacoes", label: "Automações", icon: Zap },
      { to: "/insights", label: "IA Insights", icon: Brain },
    ],
  },
  {
    label: "Negócios",
    items: [
      { to: "/comercial", label: "Comercial", icon: Target },
      { to: "/clientes", label: "Clientes", icon: Building2 },
      { to: "/financeiro", label: "Financeiro", icon: DollarSign },
    ],
  },
  {
    label: "Documentos",
    items: [
      { to: "/documentos", label: "Documentos", icon: FileText },
      { to: "/aprovacoes", label: "Aprovações", icon: ShieldCheck },
      { to: "/portal-cliente", label: "Portal do Cliente", icon: Globe },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/equipe", label: "Equipe", icon: Users },
      { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
      { to: "/perfis", label: "Perfis de Acesso", icon: UserCog },
    ],
  },
  {
    label: "Sistema",
    items: [
      { to: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
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

function NavLink({ item, active, collapsed, onNavigate }: {
  item: (typeof navGroups)[number]["items"][number];
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg text-sm transition-colors ${collapsed ? "justify-center h-10 w-10 mx-auto" : "px-3 py-2"} ${active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function SidebarBody({ collapsed, pathname, onNavigate }: { collapsed: boolean; pathname: string; onNavigate?: () => void }) {
  const me = users[0];
  const navRef = useRef<HTMLElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = () => {
    const el = navRef.current;
    if (!el) return;
    setCanScrollDown(el.scrollHeight > el.clientHeight + el.scrollTop + 2);
  };

  useEffect(() => {
    checkScroll();
    const el = navRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, []);

  const scrollDown = () => {
    const el = navRef.current;
    if (!el) return;
    el.scrollBy({ top: el.clientHeight * 0.75, behavior: "smooth" });
  };

  return (
    <div className="flex h-full flex-col">
      <div className={`flex items-center gap-2 border-b border-sidebar-border ${collapsed ? "px-3 py-4 justify-center" : "px-4 py-4"}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-5 text-primary-foreground font-bold text-xs">GS</div>
        {!collapsed && (
          <div className="leading-tight min-w-0">
            <div className="text-sm font-semibold truncate">Grupo | Sorrisos</div>
            <div className="text-[10px] text-sidebar-foreground/60 truncate">Plataforma Gestão</div>
          </div>
        )}
      </div>
      <div className="relative flex-1 overflow-hidden">
        <nav ref={navRef} className={`h-full overflow-y-auto py-3 scrollbar-hide ${collapsed ? "px-2" : "px-3"}`}>
          <TooltipProvider delayDuration={0}>
            {navGroups.map((group, gi) => (
              <div key={group.label} className={gi > 0 ? (collapsed ? "mt-3" : "mt-4") : undefined}>
                {!collapsed && (
                  <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                    {group.label}
                  </div>
                )}
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                    const link = <NavLink key={item.to} item={item} active={active} collapsed={collapsed} onNavigate={onNavigate} />;
                    return collapsed ? (
                      <Tooltip key={item.to}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : link;
                  })}
                </div>
              </div>
            ))}
          </TooltipProvider>
        </nav>
        {canScrollDown && (
          <button
            onClick={scrollDown}
            aria-label="Mais menu abaixo"
            className={`absolute bottom-0 left-0 right-0 h-10 flex items-end justify-center pb-1 pointer-events-auto transition-opacity duration-200 ${collapsed ? "bg-gradient-to-t from-[var(--sidebar)] via-[var(--sidebar)]/90 to-transparent" : "bg-gradient-to-t from-[var(--sidebar)] via-[var(--sidebar)]/90 to-transparent"}`}
          >
            <ChevronDown className="h-4 w-4 text-sidebar-foreground/60 animate-bounce" />
          </button>
        )}
      </div>
      <div className={`border-t border-sidebar-border ${collapsed ? "p-2" : "p-3"}`}>
        <div className={`flex items-center gap-3 rounded-lg ${collapsed ? "justify-center" : "px-2 py-2"}`}>
          <Avatar className="h-9 w-9 shrink-0"><AvatarFallback style={{ backgroundColor: me.color, color: "white" }}>{me.initials}</AvatarFallback></Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{me.name}</div>
              <div className="text-xs text-muted-foreground truncate">{me.role}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children, title, subtitle, actions, primaryAction }: { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode; primaryAction?: ReactNode }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const theme = useTheme();
  const [createOpen, setCreateOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem("sidebar-collapsed");
      if (v === "1") setCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(c => {
      const nv = !c;
      try { localStorage.setItem("sidebar-collapsed", nv ? "1" : "0"); } catch {}
      return nv;
    });
  };

  return (
    <div className="flex min-h-screen w-full bg-muted/40 text-foreground p-0 md:p-3 md:gap-3">
      {/* Desktop sidebar — detached card */}
      <aside
        className={`hidden md:flex shrink-0 flex-col rounded-lg border border-sidebar-border text-sidebar-foreground shadow-xl shadow-primary/10 overflow-hidden sticky top-3 self-start transition-[width] duration-200 ease-out ${collapsed ? "w-[72px]" : "w-64"}`}
        style={{ height: "calc(100vh - 1.5rem)", background: "linear-gradient(180deg, var(--sidebar) 0%, color-mix(in oklab, var(--sidebar) 80%, black) 100%)" }}
      >
        <SidebarBody collapsed={collapsed} pathname={pathname} />
      </aside>

      {/* Mobile sidebar — drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <SidebarBody collapsed={false} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="flex-1 flex flex-col min-w-0 rounded-none md:rounded-lg bg-background border-0 md:border border-border overflow-hidden">
        <header className="sticky top-0 z-20 flex items-center gap-2 md:gap-3 border-b border-border bg-background/85 backdrop-blur px-3 md:px-6 h-16">
          <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </Button>
          <Button size="icon" variant="ghost" className="hidden md:inline-flex" onClick={toggleCollapsed} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm md:text-lg font-semibold truncate">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground truncate hidden sm:block">{subtitle}</p>}
          </div>
          <div className="hidden xl:flex items-center relative">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar tarefas, projetos..." className="pl-9 w-64 h-9 bg-muted/50 border-transparent focus-visible:bg-card" />
          </div>
          <TimerChip />
          <div className="hidden sm:contents">{actions}</div>
          <Button size="icon" variant="ghost" onClick={() => themeStore.toggle()} aria-label="Alternar tema">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="relative hidden sm:inline-flex" aria-label="Notificações">
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-destructive" />
          </Button>
          {primaryAction !== undefined ? primaryAction : <Button size="sm" className="hidden sm:inline-flex" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova Tarefa</Button>}
        </header>
        <div className="flex-1 min-w-0 overflow-auto">{children}</div>
      </main>
      <CreateTaskWizard open={createOpen} onClose={() => setCreateOpen(false)} />
      <AIAssistant />
    </div>
  );
}
