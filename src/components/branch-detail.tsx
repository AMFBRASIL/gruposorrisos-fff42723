import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Building2, Package, Pencil, ShoppingCart, Users, Warehouse } from "lucide-react";
import { loadBranchDetail, type BranchDetail } from "@/lib/branches-live";
import type { Branch } from "@/lib/erp";

const typeLabel = { administracao: "Administração", cd: "Centro de Distribuição", clinica: "Clínica" };
const orderLabel: Record<string, string> = {
  rascunho: "Rascunho", enviado: "Aguardando aprovação", correcao: "Correção solicitada", rejeitado: "Rejeitado",
  aprovado: "Aguardando separação", separacao: "Em separação", transporte: "Em transporte",
  recebido_parcial: "Parcialmente recebido", concluido: "Concluído", cancelado: "Cancelado",
};

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateOf = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : "—";
};

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium break-words">{value || "—"}</div>
    </div>
  );
}

export function BranchDetailModal({ branch, canEdit, onClose, onEdit }: { branch: Branch; canEdit: boolean; onClose: () => void; onEdit: (branch: Branch) => void }) {
  const [detail, setDetail] = useState<BranchDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void loadBranchDetail(branch.id).then((next) => {
      if (!cancelled) setDetail(next);
    }).catch(() => {
      if (!cancelled) setError("Não foi possível carregar os dados da filial.");
    });
    return () => { cancelled = true; };
  }, [branch.id]);

  const current = detail ?? { ...branch, stockValue: 0, stock: [], people: [], orders: [] };
  const stockShown = current.stock.filter((item) => item.qty !== 0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0 gap-0 flex flex-col h-[90dvh] overflow-hidden">
        <div className="border-b border-border px-6 py-5 pr-14">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{current.code}</span>
                <Badge variant="outline" className={current.active ? "bg-success/10 text-success border-success/30" : ""}>{current.active ? "Ativa" : "Inativa"}</Badge>
                <Badge variant="outline">{typeLabel[current.type]}</Badge>
              </div>
              <DialogTitle className="mt-2 text-2xl font-semibold tracking-tight">{current.name}</DialogTitle>
              <DialogDescription className="mt-1">{[current.city, current.state].filter(Boolean).join("/") || "Local não informado"} · {current.manager || "Gestor não informado"}</DialogDescription>
            </div>
            {canEdit && <Button onClick={() => onEdit(current)}><Pencil className="h-4 w-4 mr-2" />Editar filial</Button>}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric label="Valor em estoque" value={money(current.stockValue)} hint={`${stockShown.length} itens com saldo`} />
            <Metric label="Depósitos" value={String(current.warehouses.length)} />
            <Metric label="Usuários" value={String(current.people.length)} />
            <Metric label="Pedidos" value={String(current.orders.length)} />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <section className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2 font-semibold"><Building2 className="h-4 w-4 text-primary" />Cadastro</div>
              <div className="grid grid-cols-2 gap-4">
                <Fact label="Razão social" value={current.legalName} />
                <Fact label="CNPJ" value={current.cnpj} />
                <Fact label="Endereço" value={current.address} />
                <Fact label="Cidade" value={[current.city, current.state].filter(Boolean).join("/")} />
                <Fact label="Telefone" value={current.phone} />
                <Fact label="E-mail" value={current.email} />
                <Fact label="Centro de custo" value={current.costCenter} />
                <Fact label="Região" value={current.region} />
                <Fact label="Gestor" value={current.manager} />
                <Fact label="Abertura" value={dateOf(current.openedAt)} />
              </div>
            </section>
            <section className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2 font-semibold"><Warehouse className="h-4 w-4 text-primary" />Depósitos</div>
              {current.warehouses.length === 0 && <p className="text-sm text-muted-foreground">Nenhum depósito cadastrado.</p>}
              {current.warehouses.map((warehouse) => (
                <div key={warehouse.id || warehouse.name} className="border-b border-border pb-3 last:border-0">
                  <div className="font-medium">{warehouse.name}</div>
                  <div className="text-xs text-muted-foreground">{warehouse.locations.join(" · ") || "Sem localizações"}</div>
                </div>
              ))}
            </section>
          </div>
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 font-semibold mb-3"><Package className="h-4 w-4 text-primary" />Estoque da filial</div>
            {stockShown.length === 0 && <p className="text-sm text-muted-foreground">Nenhum saldo nesta filial.</p>}
            <div className="divide-y divide-border text-sm">
              {stockShown.map((item) => (
                <div key={item.name} className="py-2 flex justify-between gap-3">
                  <span>{item.name}</span>
                  <span className={item.qty < item.min ? "text-warning font-medium" : "font-medium"}>{item.qty} {item.unit}</span>
                </div>
              ))}
            </div>
          </section>
          <div className="grid lg:grid-cols-2 gap-4">
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 font-semibold mb-3"><Users className="h-4 w-4 text-primary" />Usuários vinculados</div>
              {current.people.length === 0 && <p className="text-sm text-muted-foreground">Nenhum usuário vinculado.</p>}
              {current.people.map((person) => (
                <div key={person.id} className="py-1.5 text-sm flex justify-between gap-3"><span>{person.name}</span><span className="text-muted-foreground">{person.role}</span></div>
              ))}
            </section>
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 font-semibold mb-3"><ShoppingCart className="h-4 w-4 text-primary" />Pedidos</div>
              {current.orders.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido.</p>}
              {current.orders.map((order) => (
                <div key={order.id} className="py-2 flex justify-between gap-3 text-sm border-b border-border last:border-0">
                  <span className="font-mono">{order.number}</span>
                  <Badge variant="outline">{orderLabel[order.status] ?? order.status}</Badge>
                </div>
              ))}
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
