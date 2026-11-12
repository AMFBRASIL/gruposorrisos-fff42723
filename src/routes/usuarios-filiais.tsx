import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WizardShell, WizardFooter, ReviewGrid } from "@/components/erp-wizard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useErp, useSession, saveErpUser, toggleRolePermission, branchName, userName, PERMISSIONS, type ErpUser } from "@/lib/erp";
import { Plus, Trash2, Users, Building2, FileCheck2 } from "lucide-react";

export const Route = createFileRoute("/usuarios-filiais")({
  head: () => ({ meta: [
    { title: "Usuários e Permissões | Grupo Sorrisos" },
    { name: "description", content: "Vincule usuários às filiais e defina permissões por perfil e ação." },
    { property: "og:title", content: "Usuários e Permissões | Grupo Sorrisos" },
    { property: "og:description", content: "Usuários por filial e permissões granulares." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

function Page() {
  const s = useErp(); const ses = useSession();
  const [edit, setEdit] = useState<ErpUser | null>(null);
  const [roleId, setRoleId] = useState(s.roles[0].id);
  const role = s.roles.find(r => r.id === roleId)!;
  const canManage = ses.can("usuarios.gerenciar");
  return (
    <AppShell title="Usuários e Permissões" subtitle="Vínculos por filial, perfis e auditoria" primaryAction={canManage ? <Button size="sm" onClick={() => setEdit({ id: `u${Date.now()}`, name: "", initials: "", color: "#2563eb", email: "", memberships: [{ branchId: "c1", roleId: "colaborador" }] })}><Plus className="h-4 w-4 mr-1" />Novo Usuário</Button> : null}>
      <div className="p-4 md:p-8">
        {!canManage && <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 text-sm p-3">Você está em modo consulta: seu perfil não pode alterar usuários ou permissões.</div>}
        <Tabs defaultValue="usuarios">
          <TabsList><TabsTrigger value="usuarios">Usuários por filial</TabsTrigger><TabsTrigger value="permissoes">Permissões por perfil</TabsTrigger><TabsTrigger value="auditoria">Auditoria</TabsTrigger></TabsList>
          <TabsContent value="usuarios">
            <Card className="divide-y divide-border">
              {s.users.map(u => (
                <div key={u.id} className="p-4 flex items-center gap-3">
                  <Avatar className="h-10 w-10"><AvatarFallback style={{ backgroundColor: u.color, color: "white" }}>{u.initials}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0"><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div></div>
                  <div className="hidden md:flex flex-wrap gap-1 justify-end max-w-md">{u.memberships.map((m, i) => <Badge key={i} variant="outline">{branchName(m.branchId)} · {s.roles.find(r => r.id === m.roleId)?.name}</Badge>)}</div>
                  {canManage && <Button size="sm" variant="outline" onClick={() => setEdit(u)}>Editar</Button>}
                </div>
              ))}
            </Card>
          </TabsContent>
          <TabsContent value="permissoes">
            <div className="grid md:grid-cols-[280px_1fr] gap-4">
              <Card className="p-2 h-fit">{s.roles.map(r => (
                <button key={r.id} onClick={() => setRoleId(r.id)} className={`w-full text-left rounded-md px-3 py-2 ${r.id === roleId ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                  <div className="text-sm font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.scope === "all" ? "Todas as filiais" : "Filiais vinculadas"}</div>
                </button>))}
              </Card>
              <Card className="p-5">
                <div className="font-semibold">{role.name}</div><div className="text-sm text-muted-foreground mb-4">{role.description}</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {PERMISSIONS.map(p => (
                    <label key={p} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                      <span className="font-mono text-xs">{p}</span>
                      <Switch checked={role.permissions.includes(p)} disabled={!canManage} onCheckedChange={() => { const e = toggleRolePermission(role.id, p); if (e) toast.error(e); }} />
                    </label>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="auditoria">
            <Card className="divide-y divide-border">
              {s.audit.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nenhuma alteração registrada nesta sessão.</div>}
              {s.audit.map((a, i) => <div key={i} className="p-3 text-sm flex justify-between"><span>{a.action}</span><span className="text-muted-foreground">{userName(a.userId)} · {new Date(a.at).toLocaleString("pt-BR")}</span></div>)}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      {edit && <UserDialog user={edit} onClose={() => setEdit(null)} />}
    </AppShell>
  );
}

function UserDialog({ user, onClose }: { user: ErpUser; onClose: () => void }) {
  const s = useErp();
  const [u, setU] = useState(user);
  const [step, setStep] = useState(0);
  const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  const save = () => { const e = saveErpUser({ ...u, initials: u.initials || u.name.split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase() }); if (e) return toast.error(e); toast.success("Usuário salvo"); onClose(); };
  return (
    <WizardShell open onClose={onClose} badge="Usuários e filiais" headline="Equipe Grupo Sorrisos" sub={user.name || "Novo usuário"} steps={[{ title: "Identificação", desc: "Nome e contato", icon: Users }, { title: "Filiais e perfis", desc: "Vínculos de acesso", icon: Building2 }, { title: "Revisão", desc: "Conferência do cadastro", icon: FileCheck2 }]} step={step} setStep={setStep} footer={<WizardFooter step={step} last={2} setStep={setStep} onClose={onClose} onFinish={save} finishLabel="Salvar usuário" canNext={step === 0 ? !!u.name.trim() && !!u.email.trim() : u.memberships.length > 0} />}>
        {step === 0 && <>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Nome</Label><Input value={u.name} onChange={e => setU({ ...u, name: e.target.value })} /></div>
          <div className="space-y-1"><Label>E-mail</Label><Input value={u.email} onChange={e => setU({ ...u, email: e.target.value })} /></div>
        </div>
        </>}
        {step === 1 && <div className="space-y-2">
          <div className="flex justify-between items-center"><Label>Filiais e perfis</Label><Button size="sm" variant="outline" onClick={() => setU({ ...u, memberships: [...u.memberships, { branchId: s.branches[0].id, roleId: "colaborador" }] })}><Plus className="h-3 w-3 mr-1" />Vínculo</Button></div>
          {u.memberships.map((m, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
              <select className={sel} value={m.branchId} onChange={e => setU({ ...u, memberships: u.memberships.map((x, j) => j === i ? { ...x, branchId: e.target.value } : x) })}>{s.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              <select className={sel} value={m.roleId} onChange={e => setU({ ...u, memberships: u.memberships.map((x, j) => j === i ? { ...x, roleId: e.target.value } : x) })}>{s.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
              <Button size="icon" variant="ghost" aria-label="Remover vínculo" onClick={() => setU({ ...u, memberships: u.memberships.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>}
        {step === 2 && <><ReviewGrid items={[["Nome",u.name],["E-mail",u.email],["Vínculos",String(u.memberships.length)]]} />{u.memberships.map((m,i) => <div key={i} className="border-b border-border py-3 text-sm">{branchName(m.branchId)} · {s.roles.find(r => r.id === m.roleId)?.name}</div>)}</>}
    </WizardShell>
  );
}
