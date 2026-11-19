import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WizardShell, WizardFooter, ReviewGrid } from "@/components/erp-wizard";
import { StockStat, ChartCard } from "@/components/stock-ui";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { useAuth } from "@/lib/auth";
import { useDirectory } from "@/lib/directory";
import { saveLiveBranch, toggleLiveBranch, useBranches } from "@/lib/branches-live";
import { BranchDetailModal } from "@/components/branch-detail";
import type { Branch, BranchType } from "@/lib/erp";
import { Plus, MapPin, Warehouse, Users, Building2, Truck, Landmark, Trash2, Search, FileCheck2, Contact, SlidersHorizontal } from "lucide-react";

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
  const auth = useAuth();
  const directory = useDirectory();
  const branches = useBranches();
  const [edit, setEdit] = useState<Branch | null>(null);
  const [detail, setDetail] = useState<Branch | null>(null);
  const [query, setQuery] = useState(""); const [type, setType] = useState("all"); const [status, setStatus] = useState("all");
  const canManage = !!auth.user?.permissions.includes("filiais.gerenciar");
  const list = branches;
  const shown = list.filter(b => `${b.name} ${b.code} ${b.city} ${b.manager}`.toLowerCase().includes(query.toLowerCase()) && (type === "all" || b.type === type) && (status === "all" || b.active === (status === "active")));
  const regions = [...new Set(list.map(b => b.region))].map(name => ({ name: name || "Não definida", unidades: list.filter(b => b.region === name).length }));
  const blank = (): Branch => ({ id: "", code: "", name: "", type: "clinica", legalName: "", cnpj: "", address: "", city: "", state: "SP", phone: "", email: "", manager: "", costCenter: "", region: "", active: true, openedAt: new Date().toISOString().slice(0, 10), warehouses: [{ id: "", name: "Almoxarifado", locations: ["Armário 1"] }] });
  return (
    <AppShell title="Filiais" subtitle="Unidades, centros de distribuição e depósitos" primaryAction={canManage ? <Button size="sm" onClick={() => setEdit(blank())}><Plus className="h-4 w-4 mr-1" /> Nova Filial</Button> : null}>
      <div className="p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3"><StockStat label="Unidades" value={list.length} icon={Building2} /><StockStat label="Em operação" value={list.filter(b => b.active).length} icon={MapPin} tone="success" /><StockStat label="Depósitos" value={list.reduce((n,b) => n+b.warehouses.length,0)} icon={Warehouse} /><StockStat label="Equipe vinculada" value={directory.users.filter(u => u.memberships.some(m => list.some(b => b.id === m.branchId))).length} icon={Users} tone="info" /></div>
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6 border-y border-border py-5"><div><h2 className="text-lg font-semibold">Rede Grupo Sorrisos</h2><div className="grid grid-cols-3 gap-4 mt-5">{Object.entries(typeMeta).map(([key, meta]) => <div key={key}><meta.icon className="h-5 w-5 text-primary mb-3" /><div className="text-2xl font-semibold">{list.filter(b => b.type === key).length}</div><div className="text-xs text-muted-foreground mt-1">{meta.label}</div></div>)}</div></div><ChartCard title="Distribuição regional" desc="Unidades por região"><ResponsiveContainer><BarChart data={regions} layout="vertical"><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={90} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="unidades" fill="var(--chart-2)" radius={4} /></BarChart></ResponsiveContainer></ChartCard></div>
        <div className="flex flex-wrap items-center gap-3"><div className="relative flex-1 min-w-48"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar filial" placeholder="Nome, código, cidade ou gestor" className="pl-9" value={query} onChange={e => setQuery(e.target.value)} /></div><select aria-label="Tipo de filial" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={type} onChange={e => setType(e.target.value)}><option value="all">Todos os tipos</option>{Object.entries(typeMeta).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select><select aria-label="Situação da filial" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todas as situações</option><option value="active">Ativas</option><option value="inactive">Inativas</option></select><span className="text-xs text-muted-foreground">{shown.length} unidades</span></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map(b => { const T = typeMeta[b.type]; const users = directory.users.filter(u => u.memberships.some(m => m.branchId === b.id)).length; return (
          <Card key={b.id} onClick={() => setDetail(b)} className={`p-5 space-y-4 rounded-lg cursor-pointer ${b.active ? "" : "opacity-60"}`}>
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><T.icon className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0"><div className="font-semibold truncate">{b.name}</div><div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{b.city} · {b.code}</div></div>
              <Badge variant="outline" className={b.active ? "bg-success/10 text-success border-success/30" : ""}>{b.active ? "Ativa" : "Inativa"}</Badge>
            </div>
            <div className="text-xs text-muted-foreground space-y-2"><div>{b.address} · {b.city}/{b.state}</div><div>Gestor: <span className="text-foreground">{b.manager || "Não informado"}</span></div><div>Centro de custo: {b.costCenter || "—"} · {b.region}</div></div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md bg-muted/50 py-2"><div className="text-muted-foreground">Tipo</div><div className="font-medium truncate px-1">{T.label}</div></div>
              <div className="rounded-md bg-muted/50 py-2"><div className="text-muted-foreground flex items-center justify-center gap-1"><Warehouse className="h-3 w-3" />Depósitos</div><div className="font-medium">{b.warehouses.length}</div></div>
              <div className="rounded-md bg-muted/50 py-2"><div className="text-muted-foreground flex items-center justify-center gap-1"><Users className="h-3 w-3" />Usuários</div><div className="font-medium">{users}</div></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={(event) => { event.stopPropagation(); setDetail(b); }}>Detalhes</Button>
              {canManage && <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); setEdit(b); }}>Editar</Button>}
              {canManage && <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); void toggleLiveBranch(b.id).then(err => { if (err) toast.error(err); else toast.success(b.active ? "Filial inativada" : "Filial reativada"); }); }}>{b.active ? "Inativar" : "Ativar"}</Button>}
            </div>
          </Card>
        ); })}
        </div>{!shown.length && <div className="py-12 text-center text-muted-foreground">Nenhuma filial encontrada.</div>}
      </div>
      {detail && <BranchDetailModal branch={detail} canEdit={canManage} onClose={() => setDetail(null)} onEdit={(branch) => { setDetail(null); setEdit(branch); }} />}
      {edit && <BranchDialog branch={edit} onClose={() => setEdit(null)} />}
    </AppShell>
  );
}

function BranchDialog({ branch, onClose }: { branch: Branch; onClose: () => void }) {
  const [b, setB] = useState(branch); const [step, setStep] = useState(0);
  const f = (k: keyof Branch) => ({ value: String(b[k]), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setB({ ...b, [k]: e.target.value }) });
  const save = () => { void saveLiveBranch(b).then(err => { if (err) return toast.error(err); toast.success("Filial salva"); onClose(); }); };
  const fields: [keyof Branch, string][] = [["name", "Nome da filial"], ["code", "Código interno"], ["legalName", "Razão social"], ["cnpj", "CNPJ"], ["address", "Endereço"], ["city", "Cidade"], ["state", "Estado"], ["phone", "Telefone"], ["email", "E-mail"], ["manager", "Gestor responsável"], ["costCenter", "Centro de custo"], ["region", "Região"], ["openedAt", "Data de abertura"]];
  return (
    <WizardShell open onClose={onClose} badge={branch.name ? "Editar unidade" : "Nova filial"} headline="Rede Grupo Sorrisos" sub={branch.name || "Nova unidade"} steps={[{ title: "Identificação", desc: "Tipo e dados da unidade", icon: Building2 }, { title: "Localização e gestão", desc: "Endereço, contato e responsáveis", icon: Contact }, { title: "Depósitos", desc: "Estrutura e localizações", icon: Warehouse }, { title: "Revisão", desc: "Conferência do cadastro", icon: FileCheck2 }]} step={step} setStep={setStep} footer={<WizardFooter step={step} last={3} setStep={setStep} onClose={onClose} onFinish={save} finishLabel="Salvar filial" canNext={step !== 0 || !!b.name.trim() && !!b.code.trim()} />}>
        {step === 0 && <>

        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(typeMeta) as BranchType[]).map(k => { const T = typeMeta[k]; return (
            <Button variant="outline" key={k} onClick={() => setB({ ...b, type: k })} className={`h-auto min-w-0 whitespace-normal block rounded-lg border p-3 text-left transition-all ${b.type === k ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40"}`}>
              <T.icon className="h-5 w-5 mb-2 text-primary" /><div className="font-medium text-sm">{T.label}</div>
            </Button>
          ); })}
        </div>
        </> }
        {(step === 0 || step === 1) && <div className="grid md:grid-cols-2 gap-4">
          {fields.filter(([k]) => step === 0 ? ["name","code","legalName","cnpj","openedAt"].includes(k) : !["name","code","legalName","cnpj","openedAt"].includes(k)).map(([k, l]) => <div key={k} className="space-y-1"><Label htmlFor={`branch-${k}`}>{l}</Label><Input id={`branch-${k}`} {...f(k)} type={k === "openedAt" ? "date" : "text"} /></div>)}
        </div>}
        {step === 2 && <div className="space-y-4">
          <div className="flex items-center justify-between"><Label>Depósitos e localizações</Label><Button size="sm" variant="outline" onClick={() => setB({ ...b, warehouses: [...b.warehouses, { id: "", name: "Novo depósito", locations: [] }] })}><Plus className="h-3 w-3 mr-1" />Depósito</Button></div>
          {b.warehouses.map((w, i) => (
            <div key={`${w.id}-${i}`} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2">
              <Input aria-label={`Nome do depósito ${i+1}`} value={w.name} onChange={e => setB({ ...b, warehouses: b.warehouses.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
              <Input placeholder="Localizações separadas por vírgula" value={w.locations.join(", ")} onChange={e => setB({ ...b, warehouses: b.warehouses.map((x, j) => j === i ? { ...x, locations: e.target.value.split(",").map(t => t.trim()).filter(Boolean) } : x) })} />
              <Button size="icon" variant="ghost" aria-label="Remover depósito" onClick={() => setB({ ...b, warehouses: b.warehouses.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>}
        {step === 3 && <><ReviewGrid items={[["Unidade",b.name],["Código",b.code],["Tipo",typeMeta[b.type].label],["Cidade / UF",`${b.city} / ${b.state}`],["Gestor",b.manager || "—"],["Centro de custo",b.costCenter || "—"],["CNPJ",b.cnpj || "—"],["Contato",b.email || b.phone || "—"],["Depósitos",String(b.warehouses.length)]]} /><div className="space-y-3">{b.warehouses.map(w => <div key={w.id} className="border-b border-border pb-3"><div className="font-medium">{w.name}</div><div className="text-sm text-muted-foreground">{w.locations.join(" · ") || "Sem localizações"}</div></div>)}</div></>}
    </WizardShell>
  );
}
