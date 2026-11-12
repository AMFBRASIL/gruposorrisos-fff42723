import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useErp, useSession, saveBranch, toggleBranch, type Branch, type BranchType } from "@/lib/erp";
import { Plus, MapPin, Warehouse, Users, Building2, Truck, Landmark, Trash2 } from "lucide-react";

export const Route = createFileRoute("/filiais")({
  head: () => ({ meta: [
    { title: "Filiais | Grupo Sorrisos" },
    { name: "description", content: "Cadastro e gestão das filiais, centros de distribuição e depósitos do Grupo Sorrisos." },
    { property: "og:title", content: "Filiais | Grupo Sorrisos" },
    { property: "og:description", content: "Gestão de filiais e depósitos." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: FiliaisPage,
});

const typeMeta: Record<BranchType, { label: string; icon: typeof Building2 }> = {
  administracao: { label: "Administração", icon: Landmark }, cd: { label: "Centro de Distribuição", icon: Truck }, clinica: { label: "Clínica", icon: Building2 },
};

function FiliaisPage() {
  const s = useErp();
  const ses = useSession();
  const [edit, setEdit] = useState<Branch | null>(null);
  const canManage = ses.can("filiais.gerenciar");
  const list = s.branches.filter(b => ses.visible.includes(b.id));
  const blank = (): Branch => ({ id: `f${Date.now()}`, code: "", name: "", type: "clinica", legalName: "", cnpj: "", address: "", city: "", state: "SP", phone: "", email: "", manager: "", costCenter: "", region: "", active: true, openedAt: new Date().toISOString().slice(0, 10), warehouses: [{ id: `w${Date.now()}`, name: "Almoxarifado", locations: ["Armário 1"] }] });
  return (
    <AppShell title="Filiais" subtitle="Unidades, centros de distribuição e depósitos · dados de exemplo" primaryAction={canManage ? <Button size="sm" onClick={() => setEdit(blank())}><Plus className="h-4 w-4 mr-1" /> Nova Filial</Button> : null}>
      <div className="p-4 md:p-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map(b => { const T = typeMeta[b.type]; const users = s.users.filter(u => u.memberships.some(m => m.branchId === b.id)).length; return (
          <Card key={b.id} className={`p-5 space-y-4 ${b.active ? "" : "opacity-60"}`}>
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><T.icon className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0"><div className="font-semibold truncate">{b.name}</div><div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{b.city} · {b.code}</div></div>
              <Badge variant="outline" className={b.active ? "bg-success/10 text-success border-success/30" : ""}>{b.active ? "Ativa" : "Inativa"}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md bg-muted/50 py-2"><div className="text-muted-foreground">Tipo</div><div className="font-medium truncate px-1">{T.label}</div></div>
              <div className="rounded-md bg-muted/50 py-2"><div className="text-muted-foreground flex items-center justify-center gap-1"><Warehouse className="h-3 w-3" />Depósitos</div><div className="font-medium">{b.warehouses.length}</div></div>
              <div className="rounded-md bg-muted/50 py-2"><div className="text-muted-foreground flex items-center justify-center gap-1"><Users className="h-3 w-3" />Usuários</div><div className="font-medium">{users}</div></div>
            </div>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline" className="flex-1"><Link to="/filial/$id" params={{ id: b.id }}>Detalhes</Link></Button>
              {canManage && <Button size="sm" variant="outline" onClick={() => setEdit(b)}>Editar</Button>}
              {canManage && <Button size="sm" variant="ghost" onClick={() => { toggleBranch(b.id); toast.success(b.active ? "Filial inativada" : "Filial reativada"); }}>{b.active ? "Inativar" : "Ativar"}</Button>}
            </div>
          </Card>
        ); })}
      </div>
      {edit && <BranchDialog branch={edit} onClose={() => setEdit(null)} />}
    </AppShell>
  );
}

function BranchDialog({ branch, onClose }: { branch: Branch; onClose: () => void }) {
  const [b, setB] = useState(branch);
  const f = (k: keyof Branch) => ({ value: String(b[k]), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setB({ ...b, [k]: e.target.value }) });
  const save = () => { const err = saveBranch(b); if (err) return toast.error(err); toast.success("Filial salva"); onClose(); };
  const fields: [keyof Branch, string][] = [["name", "Nome da filial"], ["code", "Código interno"], ["legalName", "Razão social"], ["cnpj", "CNPJ"], ["address", "Endereço"], ["city", "Cidade"], ["state", "Estado"], ["phone", "Telefone"], ["email", "E-mail"], ["manager", "Gestor responsável"], ["costCenter", "Centro de custo"], ["region", "Região"], ["openedAt", "Data de abertura"]];
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{branch.name ? `Editar ${branch.name}` : "Nova filial"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(typeMeta) as BranchType[]).map(k => { const T = typeMeta[k]; return (
            <button key={k} onClick={() => setB({ ...b, type: k })} className={`rounded-lg border p-4 text-left transition-all ${b.type === k ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40"}`}>
              <T.icon className="h-5 w-5 mb-2 text-primary" /><div className="font-medium text-sm">{T.label}</div>
            </button>
          ); })}
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {fields.map(([k, l]) => <div key={k} className="space-y-1"><Label>{l}</Label><Input {...f(k)} type={k === "openedAt" ? "date" : "text"} /></div>)}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><Label>Depósitos e localizações</Label><Button size="sm" variant="outline" onClick={() => setB({ ...b, warehouses: [...b.warehouses, { id: `w${Date.now()}`, name: "Novo depósito", locations: [] }] })}><Plus className="h-3 w-3 mr-1" />Depósito</Button></div>
          {b.warehouses.map((w, i) => (
            <div key={w.id} className="grid grid-cols-[1fr_2fr_auto] gap-2">
              <Input value={w.name} onChange={e => setB({ ...b, warehouses: b.warehouses.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
              <Input placeholder="Localizações separadas por vírgula" value={w.locations.join(", ")} onChange={e => setB({ ...b, warehouses: b.warehouses.map((x, j) => j === i ? { ...x, locations: e.target.value.split(",").map(t => t.trim()).filter(Boolean) } : x) })} />
              <Button size="icon" variant="ghost" aria-label="Remover depósito" onClick={() => setB({ ...b, warehouses: b.warehouses.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={save}>Salvar filial</Button></div>
      </DialogContent>
    </Dialog>
  );
}
