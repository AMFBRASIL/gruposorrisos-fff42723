import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LayoutDashboard, FolderKanban, Columns3, CheckSquare, Calendar, Users as UsersIcon,
  BarChart3, Settings, UserCog, Plus, Save, ShieldCheck, Palette,
} from "lucide-react";
import { useUserProfiles, usersStore, type UserProfile } from "@/lib/store";

export const Route = createFileRoute("/perfis")({
  head: () => ({ meta: [
    { title: "Perfil de Usuários — Grupo Sorrisos Tasks" },
    { name: "description", content: "Cadastro e edição de perfis de usuários e controle de acesso às páginas." },
  ]}),
  component: ProfilesPage,
});

const PAGES = [
  { id: "/", label: "Dashboard", desc: "Visão geral e indicadores", icon: LayoutDashboard },
  { id: "/projetos", label: "Projetos", desc: "Lista e criação de projetos", icon: FolderKanban },
  { id: "/kanban", label: "Kanban", desc: "Quadro de tarefas", icon: Columns3 },
  { id: "/minhas-tarefas", label: "Minhas Tarefas", desc: "Tarefas atribuídas ao usuário", icon: CheckSquare },
  { id: "/calendario", label: "Calendário", desc: "Agenda e prazos", icon: Calendar },
  { id: "/equipe", label: "Equipe", desc: "Membros e departamentos", icon: UsersIcon },
  { id: "/relatorios", label: "Relatórios", desc: "Indicadores e análises", icon: BarChart3 },
  { id: "/configuracoes", label: "Configurações", desc: "Preferências do sistema", icon: Settings },
  { id: "/perfis", label: "Perfil de Usuários", desc: "Gestão de perfis e acessos", icon: UserCog },
];

const ROLES = ["Colaborador(a)", "Supervisor(a)", "Gerente", "Diretor(a)"];
const DEPARTMENTS = ["Operações", "Diretoria", "Financeiro", "TI", "Marketing", "RH", "Comercial", "Jurídico"];
const COLORS = [
  "oklch(0.6 0.18 260)", "oklch(0.65 0.18 25)", "oklch(0.62 0.16 155)",
  "oklch(0.7 0.18 340)", "oklch(0.65 0.14 230)", "oklch(0.7 0.15 70)",
  "oklch(0.6 0.2 295)", "oklch(0.65 0.15 190)",
];

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";

function ProfilesPage() {
  const profiles = useUserProfiles();
  const [selectedId, setSelectedId] = useState<string | null>(profiles[0]?.id ?? null);
  const [creating, setCreating] = useState(false);

  const selected = creating ? null : profiles.find(p => p.id === selectedId) ?? null;

  return (
    <AppShell title="Perfil de Usuários" subtitle="Cadastre perfis e controle o acesso às páginas" actions={
      <Button size="sm" className="hidden md:inline-flex" onClick={() => { setCreating(true); }}>
        <Plus className="h-4 w-4 mr-1" /> Novo Perfil
      </Button>
    }>
      <div className="p-4 md:p-8 grid grid-cols-1 lg:grid-cols-[280px_1fr_1fr] gap-4 items-start">
        {/* User list */}
        <Card className="p-3">
          <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Perfis ({profiles.length})</div>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
            {profiles.map(p => {
              const active = !creating && p.id === selectedId;
              return (
                <button
                  key={p.id} type="button"
                  onClick={() => { setCreating(false); setSelectedId(p.id); }}
                  className={`w-full flex items-center gap-3 rounded-lg p-2.5 text-left transition-all ${
                    active ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/60"
                  }`}
                >
                  <span className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0" style={{ backgroundColor: p.color }}>
                    {p.initials}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{p.role} · {p.department}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo Perfil
          </Button>
        </Card>

        {/* Profile form (left) */}
        <ProfileEditor
          key={creating ? "new" : selected?.id ?? "none"}
          profile={selected}
          onSaved={(id) => { setCreating(false); setSelectedId(id); }}
          onCancel={creating ? () => setCreating(false) : undefined}
        />

        {/* Page access (right) */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Acesso às páginas</h3>
          </div>
          {selected ? (
            <>
              <p className="text-xs text-muted-foreground mb-4">
                Ligue ou desligue o acesso de <span className="font-medium text-foreground">{selected.name}</span> a cada página.
              </p>
              <div className="space-y-1">
                {PAGES.map(pg => {
                  const Icon = pg.icon;
                  const enabled = selected.access[pg.id] ?? false;
                  return (
                    <div key={pg.id} className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${enabled ? "bg-muted/40" : "opacity-60"}`}>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{pg.label}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{pg.desc}</div>
                      </div>
                      <Badge variant="secondary" className={`text-[10px] ${enabled ? "bg-success/15 text-success" : ""}`}>
                        {enabled ? "Liberado" : "Bloqueado"}
                      </Badge>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(v) => usersStore.setAccess(selected.id, pg.id, v)}
                        aria-label={`Acesso a ${pg.label}`}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed p-10 text-center mt-3">
              <ShieldCheck className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">Salve o novo perfil para configurar os acessos.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Novos perfis começam com acesso liberado a todas as páginas.</p>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function ProfileEditor({ profile, onSaved, onCancel }: {
  profile: UserProfile | null;
  onSaved: (id: string) => void;
  onCancel?: () => void;
}) {
  const isNew = !profile;
  const [name, setName] = useState(profile?.name ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [role, setRole] = useState(profile?.role ?? ROLES[0]);
  const [department, setDepartment] = useState(profile?.department ?? DEPARTMENTS[0]);
  const [color, setColor] = useState(profile?.color ?? COLORS[0]);
  const [saved, setSaved] = useState(false);

  const roleOptions = Array.from(new Set([...(profile ? [profile.role] : []), ...ROLES]));
  const departmentOptions = Array.from(new Set([...(profile ? [profile.department] : []), ...DEPARTMENTS]));

  const save = () => {
    if (!name.trim()) return;
    const data = {
      name: name.trim(),
      email: email.trim() || `${name.trim().split(/\s+/)[0].toLowerCase()}@gruposorrisos.com`,
      role, department, color,
      initials: initialsOf(name),
    };
    if (isNew) {
      const id = `u_${Date.now().toString(36)}`;
      usersStore.addUser({ id, ...data });
      onSaved(id);
    } else {
      usersStore.updateUser(profile.id, data);
      onSaved(profile.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <UserCog className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">{isNew ? "Cadastrar novo perfil" : "Editar perfil"}</h3>
      </div>

      <div className="flex items-center gap-4 mb-5">
        <span className="h-16 w-16 rounded-full flex items-center justify-center text-white text-lg font-semibold shrink-0" style={{ backgroundColor: color }}>
          {initialsOf(name || "?")}
        </span>
        <div className="min-w-0">
          <div className="font-semibold truncate">{name || "Nome do usuário"}</div>
          <div className="text-xs text-muted-foreground truncate">{role} · {department}</div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nome completo</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Fernanda Rocha" className="mt-1.5 h-10" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">E-mail</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@gruposorrisos.com" className="mt-1.5 h-10" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cargo</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="mt-1.5 h-10"><SelectValue placeholder="Selecione">{role}</SelectValue></SelectTrigger>
              <SelectContent>
                {roleOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Departamento</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="mt-1.5 h-10"><SelectValue placeholder="Selecione">{department}</SelectValue></SelectTrigger>
              <SelectContent>
                {departmentOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5" /> Cor do avatar
          </Label>
          <div className="mt-2 flex flex-wrap gap-2.5">
            {COLORS.map(c => (
              <button
                key={c} type="button" onClick={() => setColor(c)}
                aria-label={`Cor ${c}`}
                className={`h-8 w-8 rounded-lg transition-all ${color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        ) : <span className="text-xs text-muted-foreground">{saved ? "✓ Alterações salvas" : ""}</span>}
        <Button onClick={save} disabled={!name.trim()}>
          <Save className="h-4 w-4" /> {isNew ? "Cadastrar perfil" : "Salvar alterações"}
        </Button>
      </div>
    </Card>
  );
}
