import type { LucideIcon } from "lucide-react";
import { ArrowRight, Bell, Boxes, Building2, CheckCircle2, ClipboardList, Clock, FileText, GitBranch, Mail, Package, Plus, ShoppingCart, Truck, Users, Wallet, Zap } from "lucide-react";
import type { ActionType } from "@/lib/mock-data";

export type CatalogEvent = { id: string; label: string; desc: string; icon: LucideIcon };
export type CatalogModule = { id: string; label: string; desc: string; icon: LucideIcon; events: CatalogEvent[] };
export type CatalogAction = { id: ActionType; label: string; desc: string; icon: LucideIcon; scope: "all" | "tarefas" };

export const AUTOMATION_MODULES: CatalogModule[] = [
  { id: "tarefas", label: "Tarefas", desc: "Kanban, prazos e responsáveis", icon: CheckCircle2, events: [
    { id: "task_created", label: "Tarefa criada", desc: "Quando uma tarefa nova entra no quadro", icon: Plus },
    { id: "status_change", label: "Mudança de status", desc: "Quando a tarefa muda de coluna", icon: ArrowRight },
    { id: "assigned", label: "Atribuição", desc: "Quando o responsável muda", icon: GitBranch },
    { id: "due_soon", label: "Prazo próximo", desc: "Quando o vencimento está perto", icon: Clock },
    { id: "overdue", label: "Tarefa atrasada", desc: "Quando passa do prazo", icon: Zap },
  ] },
  { id: "pedidos", label: "Pedidos", desc: "Pedidos de material e etapas", icon: ClipboardList, events: [
    { id: "order_created", label: "Pedido criado", desc: "Um pedido de material foi gravado", icon: Plus },
    { id: "order_submitted", label: "Pedido enviado", desc: "Saiu de rascunho para aprovação", icon: ArrowRight },
    { id: "order_approved", label: "Pedido aprovado", desc: "A aprovação comercial foi concluída", icon: CheckCircle2 },
    { id: "order_picked", label: "Pedido separado", desc: "O CD iniciou a separação", icon: Package },
    { id: "order_shipped", label: "Pedido em transporte", desc: "A carga saiu para a filial", icon: Truck },
    { id: "order_received", label: "Pedido recebido", desc: "A filial conferiu a entrega", icon: Package },
    { id: "order_stage", label: "Etapa do fluxo", desc: "A situação do pedido avançou", icon: GitBranch },
    { id: "order_closed", label: "Pedido concluído", desc: "O pedido foi encerrado", icon: CheckCircle2 },
    { id: "order_cancelled", label: "Pedido cancelado", desc: "O pedido foi cancelado ou rejeitado", icon: Zap },
  ] },
  { id: "compras", label: "Compras", desc: "Requisições e pedidos de compra", icon: ShoppingCart, events: [
    { id: "purchase_created", label: "Compra criada", desc: "Uma requisição de compra foi aberta", icon: Plus },
    { id: "quote_added", label: "Cotação lançada", desc: "Um preço de fornecedor foi registrado", icon: Wallet },
    { id: "purchase_approved", label: "Compra aprovada", desc: "A compra foi autorizada", icon: CheckCircle2 },
    { id: "purchase_sent", label: "Compra enviada", desc: "O pedido seguiu ao fornecedor", icon: Truck },
    { id: "purchase_received", label: "Compra recebida", desc: "A entrega da compra foi conferida", icon: Package },
  ] },
  { id: "fornecedores", label: "Fornecedores", desc: "Pedidos, cotações e cadastro", icon: Building2, events: [
    { id: "request_created", label: "Pedido ao fornecedor", desc: "Um pedido de cotação foi aberto", icon: Plus },
    { id: "request_answered", label: "Fornecedor respondeu", desc: "Os preços voltaram para conferência", icon: Mail },
    { id: "request_advanced", label: "Fluxo do fornecedor", desc: "A situação do pedido ao fornecedor mudou", icon: GitBranch },
    { id: "supplier_saved", label: "Fornecedor salvo", desc: "O cadastro do fornecedor foi gravado", icon: Building2 },
  ] },
  { id: "estoque", label: "Estoque", desc: "Movimentações, lotes e materiais", icon: Boxes, events: [
    { id: "movement_registered", label: "Movimentação lançada", desc: "Entrada, saída ou ajuste de estoque", icon: ArrowRight },
    { id: "lot_created", label: "Lote registrado", desc: "Um lote ou validade foi incluído", icon: Package },
    { id: "material_created", label: "Material criado", desc: "Um item novo entrou no catálogo", icon: Plus },
    { id: "adjustment_reviewed", label: "Ajuste revisado", desc: "Um inventário foi aprovado ou recusado", icon: CheckCircle2 },
    { id: "procedure_registered", label: "Consumo clínico", desc: "Um procedimento baixou materiais", icon: ClipboardList },
    { id: "restock_requested", label: "Reposição pedida", desc: "Uma sugestão de ressuprimento foi gerada", icon: Truck },
  ] },
  { id: "transferencias", label: "Transferências", desc: "Envio de material entre filiais", icon: Truck, events: [
    { id: "transfer_created", label: "Transferência criada", desc: "Uma transferência foi solicitada", icon: Plus },
    { id: "transfer_advanced", label: "Transferência avançou", desc: "O envio mudou de situação", icon: ArrowRight },
  ] },
  { id: "aprovacoes", label: "Aprovações", desc: "Solicitações e decisões", icon: CheckCircle2, events: [
    { id: "approval_created", label: "Solicitação aberta", desc: "Alguém pediu uma decisão", icon: Plus },
    { id: "approval_decided", label: "Decisão registrada", desc: "Uma etapa foi aprovada ou rejeitada", icon: CheckCircle2 },
  ] },
  { id: "documentos", label: "Documentos", desc: "Arquivos e assinaturas", icon: FileText, events: [
    { id: "document_created", label: "Documento criado", desc: "Um documento entrou na central", icon: Plus },
    { id: "document_status", label: "Situação do documento", desc: "O status do documento mudou", icon: ArrowRight },
    { id: "document_signed", label: "Assinatura", desc: "Alguém assinou o documento", icon: CheckCircle2 },
  ] },
  { id: "comercial", label: "Comercial", desc: "Clientes e negócios", icon: Users, events: [
    { id: "client_created", label: "Cliente criado", desc: "Um cliente foi cadastrado", icon: Plus },
    { id: "deal_created", label: "Negócio criado", desc: "Uma oportunidade entrou no funil", icon: Wallet },
    { id: "deal_moved", label: "Negócio mudou de etapa", desc: "O funil avançou ou foi encerrado", icon: ArrowRight },
  ] },
  { id: "financeiro", label: "Financeiro", desc: "Faturas e recebimentos", icon: Wallet, events: [
    { id: "invoice_created", label: "Fatura criada", desc: "Uma cobrança foi emitida", icon: Plus },
    { id: "invoice_paid", label: "Fatura paga", desc: "O recebimento foi confirmado", icon: CheckCircle2 },
  ] },
];

export const AUTOMATION_ACTIONS: CatalogAction[] = [
  { id: "notify", label: "Notificar", desc: "Mostra o aviso na tela assim que o evento acontece", icon: Bell, scope: "all" },
  { id: "create_task", label: "Criar tarefa", desc: "Abre uma tarefa de acompanhamento no Kanban", icon: Plus, scope: "all" },
  { id: "send_email", label: "Registrar e-mail", desc: "Deixa o aviso de e-mail registrado na tarefa", icon: Mail, scope: "all" },
  { id: "set_priority", label: "Definir prioridade", desc: "Marca a prioridade da tarefa gerada ou alterada", icon: Zap, scope: "all" },
  { id: "move_status", label: "Mover tarefa", desc: "Leva a tarefa de origem para outra coluna", icon: ArrowRight, scope: "tarefas" },
  { id: "comment", label: "Comentar", desc: "Escreve um comentário na tarefa de origem", icon: Bell, scope: "tarefas" },
];

export function moduleById(id?: string) {
  return AUTOMATION_MODULES.find((item) => item.id === (id || "tarefas")) ?? AUTOMATION_MODULES[0];
}

export function eventById(id: string) {
  for (const item of AUTOMATION_MODULES) {
    const found = item.events.find((event) => event.id === id);
    if (found) return found;
  }
  return undefined;
}

export function actionsFor(moduleId: string) {
  return AUTOMATION_ACTIONS.filter((item) => item.scope === "all" || item.scope === moduleId);
}

export function procurementEvent(path: string) {
  if (path === "/api/procurement/orders") return { module: "pedidos", event: "order_created" };
  const order = path.match(/^\/api\/procurement\/orders\/[^/]+\/([^/]+)$/);
  const orderEvents: Record<string, string> = { submit: "order_submitted", approve: "order_approved", reject: "order_cancelled", correct: "order_cancelled", pick: "order_picked", ship: "order_shipped", receive: "order_received", close: "order_closed", cancel: "order_cancelled", advance: "order_stage", duplicate: "order_created" };
  if (order && orderEvents[order[1]]) return { module: "pedidos", event: orderEvents[order[1]] };
  if (path === "/api/procurement/purchases") return { module: "compras", event: "purchase_created" };
  if (/\/purchases\/[^/]+\/quotes$/.test(path)) return { module: "compras", event: "quote_added" };
  if (/\/purchases\/[^/]+\/approve$/.test(path)) return { module: "compras", event: "purchase_approved" };
  if (/\/purchases\/[^/]+\/send$/.test(path)) return { module: "compras", event: "purchase_sent" };
  if (/\/purchases\/[^/]+\/receive$/.test(path)) return { module: "compras", event: "purchase_received" };
  if (path === "/api/procurement/requests") return { module: "fornecedores", event: "request_created" };
  if (/\/requests\/[^/]+\/respond$/.test(path)) return { module: "fornecedores", event: "request_answered" };
  if (/\/requests\/[^/]+\/action$/.test(path)) return { module: "fornecedores", event: "request_advanced" };
  if (path === "/api/procurement/suppliers") return { module: "fornecedores", event: "supplier_saved" };
  return null;
}

export function stockEvent(path: string) {
  if (path === "/api/stock/movements") return { module: "estoque", event: "movement_registered" };
  if (path === "/api/stock/lots") return { module: "estoque", event: "lot_created" };
  if (path === "/api/stock/materials") return { module: "estoque", event: "material_created" };
  if (path === "/api/stock/procedures") return { module: "estoque", event: "procedure_registered" };
  if (path === "/api/stock/replenishments") return { module: "estoque", event: "restock_requested" };
  if (/\/adjustments\/[^/]+\/review$/.test(path)) return { module: "estoque", event: "adjustment_reviewed" };
  if (path === "/api/stock/transfers") return { module: "transferencias", event: "transfer_created" };
  if (/\/transfers\/[^/]+\/advance$/.test(path)) return { module: "transferencias", event: "transfer_advanced" };
  return null;
}
