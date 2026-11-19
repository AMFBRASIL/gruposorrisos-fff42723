import {
  LayoutDashboard, FolderKanban, Columns3, CheckSquare, Calendar, Clock, FileStack,
  Warehouse, TrendingUp, Package, ArrowLeftRight, Truck, CalendarClock, ClipboardCheck,
  DollarSign, ShoppingCart, Boxes, ShoppingBag, Building2, Zap, Brain, Target,
  FileText, ShieldCheck, Globe, Network, Users, BarChart3, UserCog,
  Settings, BookOpen,
} from "lucide-react";

export const menuGroups = [
  {
    label: "Principal",
    items: [
      { to: "/", label: "Dashboard", description: "Visão geral e indicadores", icon: LayoutDashboard },
      { to: "/projetos", label: "Projetos", description: "Lista e criação de projetos", icon: FolderKanban },
      { to: "/templates", label: "Templates", description: "Modelos de projeto", icon: FileStack },
      { to: "/kanban", label: "Kanban", description: "Quadro de tarefas", icon: Columns3 },
      { to: "/minhas-tarefas", label: "Minhas Tarefas", description: "Tarefas atribuídas ao usuário", icon: CheckSquare },
      { to: "/calendario", label: "Calendário", description: "Agenda e prazos", icon: Calendar },
      { to: "/timesheet", label: "Timesheet", description: "Apontamento de horas", icon: Clock },
    ],
  },
  {
    label: "Estoque",
    items: [
      { to: "/estoque", label: "Visão Geral", description: "Posição de estoque", icon: Warehouse },
      { to: "/estoque-avancado", label: "Inteligência de Estoque", description: "Alertas e reposição", icon: TrendingUp },
      { to: "/materiais", label: "Materiais e Produtos", description: "Catálogo de materiais", icon: Package },
      { to: "/movimentacoes", label: "Movimentações", description: "Entradas e saídas", icon: ArrowLeftRight },
      { to: "/transferencias", label: "Transferências", description: "Movimento entre filiais", icon: Truck },
      { to: "/lotes-validades", label: "Lotes e Validades", description: "Controle de validade", icon: CalendarClock },
      { to: "/inventarios", label: "Inventários", description: "Contagem de estoque", icon: ClipboardCheck },
    ],
  },
  {
    label: "Pedidos & Compras",
    items: [
      { to: "/central-pendencias", label: "Central de Pendências", description: "Fila de decisões", icon: ClipboardCheck },
      { to: "/orcamentos-compras", label: "Orçamentos de Compras", description: "Limites e compromissos", icon: DollarSign },
      { to: "/desempenho-compras", label: "Desempenho de Compras", description: "Indicadores de compras", icon: TrendingUp },
      { to: "/pedidos", label: "Pedidos de Materiais", description: "Pedidos entre filiais", icon: ShoppingCart },
      { to: "/centro-distribuicao", label: "Centro de Distribuição", description: "Separação e expedição", icon: Boxes },
      { to: "/compras", label: "Compras e Fornecedores", description: "Compras e recebimento", icon: ShoppingBag },
      { to: "/fornecedores", label: "Pedidos por Fornecedor", description: "Solicitações comerciais", icon: Building2 },
    ],
  },
  {
    label: "Automação & IA",
    items: [
      { to: "/automacoes", label: "Automações", description: "Regras automáticas", icon: Zap },
      { to: "/insights", label: "IA Insights", description: "Indicadores assistidos", icon: Brain },
    ],
  },
  {
    label: "Negócios",
    items: [
      { to: "/comercial", label: "Comercial", description: "Oportunidades e negociações", icon: Target },
      { to: "/clientes", label: "Clientes", description: "Cadastro de clientes", icon: Building2 },
      { to: "/financeiro", label: "Financeiro", description: "Faturas e custos", icon: DollarSign },
    ],
  },
  {
    label: "Documentos",
    items: [
      { to: "/documentos", label: "Documentos", description: "Arquivos e contratos", icon: FileText },
      { to: "/aprovacoes", label: "Aprovações", description: "Decisões corporativas", icon: ShieldCheck },
      { to: "/portal-cliente", label: "Portal do Cliente", description: "Área do cliente", icon: Globe },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/cadastros", label: "Central de Cadastros", description: "Atalhos de cadastro", icon: FileStack },
      { to: "/cadastro-fornecedores", label: "Cadastro de Fornecedores", description: "Empresas fornecedoras", icon: Building2 },
      { to: "/filiais", label: "Filiais", description: "Unidades e depósitos", icon: Network },
      { to: "/equipe", label: "Equipe", description: "Membros, filiais e departamentos", icon: Users },
      { to: "/relatorios", label: "Relatórios", description: "Indicadores e análises", icon: BarChart3 },
      { to: "/perfis", label: "Perfis de Acesso", description: "Telas liberadas por perfil", icon: UserCog },
    ],
  },
  {
    label: "Sistema",
    items: [
      { to: "/configuracoes", label: "Configurações", description: "Preferências do sistema", icon: Settings },
      { to: "/manual-sistema", label: "Manual Sistema", description: "Documentação operacional", icon: BookOpen },
    ],
  },
] as const;

export const menuPages = menuGroups.flatMap((group) => [...group.items]);

export const ACCESS_PAGES: string[] = menuPages.map((page) => page.to);

export function pageAllowed(pages: readonly string[] | undefined, pathname: string) {
  if (!pages) return true;
  return pages.some((page) => page === pathname || (page !== "/" && pathname.startsWith(`${page}/`)) || (page === "/filiais" && pathname.startsWith("/filial/")));
}
