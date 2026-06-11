import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, FolderKanban, Columns3, CheckSquare, Calendar, Users as UsersIcon,
  BarChart3, Settings, UserCog, Plus, Save, ShieldCheck, Palette,
} from "lucide-react";
import { useAccessProfiles, accessProfilesStore, useUserProfiles, ACCESS_PAGES, type AccessProfile } from "@/lib/store";

export const Route = createFileRoute("/perfis")({
  head: () => ({ meta: [
    { title: "Perfis de Acesso — Grupo Sorrisos Tasks" },
    { name: "description", content: "Crie e edite perfis de acesso e defina as permissões de páginas de cada perfil." },
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
  { id: "/perfis", label: "Perfis de Acesso", desc: "Gestão de perfis e permissões", icon: UserCog },
];

const COLORS = [
  "oklch(0.6 0.18 260)", "oklch(0.65 0.18 25)", "oklch(0.62 0.16 155)",
  "oklch(0.7 0.18 340)", "oklch(0.65 0.14 230)", "oklch(0.7 0.15 70)",
  "oklch(0.6 0.2 295)", "oklch(0.65 0.15 190)",
];

function ProfilesPage() {
  const profiles = useAccessProfiles();
  const members = useUserProfiles();
  const [selectedId, setSelectedId] = useState<string | null>(profiles[0]?.id ?? null);
  const [creating, setCreating] = useState(false);

  const selected = creating ? null : profiles.find(p => p.id === selectedId) ?? null;
  const membersOf = (p: AccessProfile) => members.filter(m => m.profileId === p.id || m.role === p.name).length;

  return (
    <AppShell title="Perfis de Acesso" subtitle="Crie perfis e defina as permissões de páginas" primaryAction={
      <Button size="sm" className="hidden sm:inline-flex" onClick={() => setCreating(true)}>
        <Plus className="h-4 w-4 mr-1" /> Novo Perfil
      </Button>
    }>
      <div className="p-4 md:p-8 grid grid-cols-1 lg:grid-cols-[300px_1fr_1fr] gap-4 items-start">
        {/* Profile list */}
        <Card className="p-3">
          <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Perfis ({profiles.length})</div>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
            {profiles.map(p => {
              const active = !creating && p.id === selectedId;
              const liberadas = ACCESS_PAGES.filter(pg => p.access[pg]).length;
              const count = membersOf(p);
              return (
                <button
                  key={p.id} type="button"
                  onClick={() => { setCreating(false); setSelectedId(p.id); }}
                  className={`w-full flex items-center gap-3 rounded-lg p-2.5 text-left transition-all ${
                    active ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/60"
                  }`}
                >
                  <span className="h-9 w-9 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: p.color }}>
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{liberadas} páginas liberadas · {count} {count === 1 ? "membro" : "membros"}</div>
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
                Ligue ou desligue o acesso do perfil <span className="font-medium text-foreground">{selected.name}</span> a cada página.
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
                        onCheckedChange={(v) => accessProfilesStore.setAccess(selected.id, pg.id, v)}
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
              <p className="mt-3 text-sm text-muted-foreground">Salve o novo perfil para configurar as permissões.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Novos perfis começam com acesso liberado a todas as páginas.</p>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function ProfileEditor({ profile, onSaved, onCancel }: {
  profile: AccessProfile | null;
  onSaved: (id: string) => void;
  onCancel?: () => void;
}) {
  const isNew = !profile;
  const [name, setName] = useState(profile?.name ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [color, setColor] = useState(profile?.color ?? COLORS[0]);
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (!name.trim()) return;
    const data = { name: name.trim(), description: description.trim(), color };
    if (isNew) {
      const id = `ap_${Date.now().toString(36)}`;
      accessProfilesStore.addProfile({
        id, ...data,
        access: Object.fromEntries(ACCESS_PAGES.map(p => [p, true])),
      });
      onSaved(id);
    } else {
      accessProfilesStore.updateProfile(profile.id, data);
      onSaved(profile.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <UserCog className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">{isNew ? "Criar novo perfil" : "Editar perfil"}</h3>
      </div>

      <div className="flex items-center gap-4 mb-5">
        <span className="h-16 w-16 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: color }}>
          <ShieldCheck className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <div className="font-semibold truncate">{name || "Nome do perfil"}</div>
          <div className="text-xs text-muted-foreground line-clamp-2">{description || "Descrição do perfil de acesso"}</div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nome do perfil</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Coordenador(a)" className="mt-1.5 h-10" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Descrição</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que esse perfil pode fazer na plataforma..." className="mt-1.5 min-h-20" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5" /> Cor de identificação
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
          <Save className="h-4 w-4" /> {isNew ? "Criar perfil" : "Salvar alterações"}
        </Button>
      </div>
    </Card>
  );
}
