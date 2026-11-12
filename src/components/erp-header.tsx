import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Building, UserRound, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useErp, useSession, setBranchFilter, setCurrentUser, restoreSession } from "@/lib/erp";
import { useOrders, statusLabels } from "@/lib/orders";

const sel = "h-9 rounded-md border border-input bg-background px-2 text-xs md:text-sm max-w-[200px]";

export function BranchSwitcher() {
  const s = useErp();
  const ses = useSession();
  useEffect(() => { restoreSession(); }, []);
  return (
    <div className="hidden lg:flex items-center gap-2">
      <div className="flex items-center gap-1">
        <Building className="h-4 w-4 text-muted-foreground" />
        <select aria-label="Filial" className={sel} value={ses.filter} onChange={e => setBranchFilter(e.target.value)}>
          {ses.visible.length > 1 && <option value="all">Todas as filiais</option>}
          {s.branches.filter(b => ses.visible.includes(b.id)).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1" title="Simular usuário (demonstração)">
        <UserRound className="h-4 w-4 text-muted-foreground" />
        <select aria-label="Ver como" className={sel} value={s.currentUserId} onChange={e => setCurrentUser(e.target.value)}>
          {s.users.map(u => { const r = s.roles.find(x => x.id === u.memberships[0]?.roleId); return <option key={u.id} value={u.id}>{u.name} · {r?.name}</option>; })}
        </select>
      </div>
    </div>
  );
}

/** Orders waiting on an action the current user is allowed to take. */
export function usePendingForMe() {
  const orders = useOrders();
  const ses = useSession();
  return orders.filter(o =>
    (o.status === "enviado" && ses.can("pedidos.aprovar", o.branchId)) ||
    ((o.status === "aprovado" || o.status === "separacao") && ses.can("pedidos.separar", o.sourceId)) ||
    ((o.status === "transporte" || o.status === "recebido_parcial") && ses.can("pedidos.receber", o.branchId)));
}

export function NotificationsBell() {
  const pending = usePendingForMe();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="relative hidden sm:inline-flex" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          {pending.length > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4">{pending.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border text-sm font-semibold">Pendências para você</div>
        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {pending.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nenhuma pendência.</div>}
          {pending.map(o => (
            <Link key={o.id} to="/pedidos" className="block px-4 py-3 hover:bg-muted/50 text-sm">
              <div className="font-medium">{o.number}</div><div className="text-xs text-muted-foreground">{statusLabels[o.status]}</div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
