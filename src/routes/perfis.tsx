import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UserCog, Plus, Save, ShieldCheck, Palette, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { menuGroups, ACCESS_PAGES } from "@/lib/menu-pages";
import { useAccessProfiles, accessProfilesStore, useUserProfiles, type AccessProfile } from "@/lib/store";

export const Route = createFileRoute("/perfis")({
  head: () => ({ meta: [
    { title: "Perfis de Acesso — Grupo Sorrisos Tasks" },
    { name: "description", content: "Crie e edite perfis de acesso e defina as telas liberadas de cada perfil." },
    { property: "og:title", content: "Perfis de Acesso — Grupo Sorrisos Tasks" },
    { property: "og:description", content: "Crie e edite perfis de acesso e defina as telas liberadas de cada perfil." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: ProfilesPage,
});

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
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<string>(menuGroups[0]?.label ?? "");

  useEffect(() => {
    if (!creating && !selectedId && profiles[0]) setSelectedId(profiles[0].id);
  }, [creating, profiles, selectedId]);

  const selected = creating ? null : profiles.find((profile) => profile.id === selectedId) ?? null;
  const membersOf = (profile: AccessProfile) => members.filter((member) => member.profileId === profile.id || member.role === profile.name).length;
  const opened = (profile: AccessProfile) => ACCESS_PAGES.filter((page) => profile.access[page]).length;

  return (
    <AppShell title="Perfis de Acesso" subtitle="Quem pode abrir cada tela do sistema" primaryAction={
      <Button size="sm" className="hidden sm:inline-flex" onClick={() => setCreating(true)}>
        <Plus className="h-4 w-4 mr-1" /> Novo Perfil
      </Button>
    }>
      <div className="lg:h-[calc(100dvh-5.5rem)] lg:overflow-hidden p-4 md:p-6 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4 lg:min-h-0">
        <Card className="p-3 flex flex-col min-h-0 max-h-72 lg:max-h-none lg:h-full">
          <div className="px-2 py-1.5 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Perfis</div>
            <div className="text-xs text-muted-foreground">{profiles.length}</div>
          </div>
          <div className="space-y-1 flex-1 min-h-0 overflow-y-auto pr-1">
            {profiles.map((profile) => {
              const active = !creating && profile.id === selectedId;
              const count = membersOf(profile);
              return (
                <button
                  key={profile.id} type="button"
                  onClick={() => { setCreating(false); setSelectedId(profile.id); }}
                  className={`w-full flex items-center gap-3 rounded-xl p-2.5 text-left transition-all ${
                    active ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/60"
                  }`}
                >
                  <span className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: profile.color }}>
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{profile.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{opened(profile)} de {ACCESS_PAGES.length} telas · {count} {count === 1 ? "membro" : "membros"}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo Perfil
          </Button>
        </Card>

        <div className="min-h-0 min-w-0 flex flex-col gap-3 lg:h-full">
          <ProfileEditor
            key={creating ? "new" : selected?.id ?? "none"}
            profile={selected}
            members={selected ? membersOf(selected) : 0}
            pages={selected ? opened(selected) : 0}
            onSaved={(id) => { setCreating(false); setSelectedId(id); }}
            onCancel={creating ? () => setCreating(false) : undefined}
          />
          <PageAccess profile={selected} query={query} onQuery={setQuery} area={area} onArea={setArea} />
        </div>
      </div>
    </AppShell>
  );
}

function ProfileEditor({ profile, members, pages, onSaved, onCancel }: {
  profile: AccessProfile | null;
  members: number;
  pages: number;
  onSaved: (id: string) => void;
  onCancel?: () => void;
}) {
  const isNew = !profile;
  const [name, setName] = useState(profile?.name ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [color, setColor] = useState(profile?.color ?? COLORS[0]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || saving) return;
    const data = { name: name.trim(), description: description.trim(), color };
    setSaving(true);
    try {
      if (isNew) {
        const id = await accessProfilesStore.addProfile({
          id: "", ...data,
          access: Object.fromEntries(ACCESS_PAGES.map((page) => [page, true])),
        });
        onSaved(id);
      } else {
        await accessProfilesStore.updateProfile(profile.id, data);
        onSaved(profile.id);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 shrink-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className="h-11 w-11 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: color }}>
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-[180px] flex-1">
          <Label className="sr-only">Nome do perfil</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do perfil" className="h-9" />
        </div>
        <div className="min-w-[200px] flex-[1.4]">
          <Label className="sr-only">Descrição</Label>
          <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descrição do perfil" className="h-9" />
        </div>
        <div className="flex items-center gap-1.5" aria-label="Cor">
          <Palette className="h-3.5 w-3.5 text-muted-foreground" />
          {COLORS.map((item) => (
            <button
              key={item} type="button" onClick={() => setColor(item)}
              aria-label={`Cor ${item}`}
              className={`h-6 w-6 rounded-md transition-all ${color === item ? "ring-2 ring-offset-2 ring-primary" : "hover:scale-105"}`}
              style={{ backgroundColor: item }}
            />
          ))}
        </div>
        {!isNew && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
            <Users className="h-3.5 w-3.5" /> {members} {members === 1 ? "membro" : "membros"} · {pages}/{ACCESS_PAGES.length}
          </div>
        )}
        {onCancel && <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>}
        <Button size="sm" onClick={() => void save()} disabled={!name.trim() || saving}>
          {isNew ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />} {isNew ? "Criar perfil" : saved ? "Salvo" : "Salvar"}
        </Button>
      </div>
      {isNew && <p className="mt-2 text-xs text-muted-foreground">O perfil nasce com todas as telas liberadas.</p>}
    </Card>
  );
}

function PageAccess({ profile, query, onQuery, area, onArea }: {
  profile: AccessProfile | null;
  query: string;
  onQuery: (value: string) => void;
  area: string;
  onArea: (value: string) => void;
}) {
  const folded = query.trim().toLocaleLowerCase();
  const searching = folded.length > 0;
  const groups = useMemo(() => menuGroups.map((group) => ({
    label: group.label,
    pages: group.items.filter((page) => !folded || `${page.label} ${page.description}`.toLocaleLowerCase().includes(folded)),
  })), [folded]);
  const visible = searching ? groups.filter((group) => group.pages.length > 0) : groups.filter((group) => group.label === area);
  const current = groups.find((group) => group.label === area) ?? groups[0];

  return (
    <Card className="p-4 flex-1 min-h-0 flex flex-col">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div className="flex items-center gap-2">
          <UserCog className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Telas</h3>
          {profile && <span className="text-xs text-muted-foreground">de {profile.name}</span>}
        </div>
        {profile && (
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Buscar tela" className="pl-9 h-9" />
          </div>
        )}
      </div>
      {profile && (
        <div className="mt-3 flex items-center gap-2 shrink-0">
          <div className="flex gap-1.5 overflow-x-auto flex-1 min-w-0 pb-1">
            {groups.map((group) => {
              const total = menuGroups.find((item) => item.label === group.label)?.items.length ?? group.pages.length;
              const enabledCount = group.pages.filter((page) => profile.access[page.to]).length;
              const active = !searching && group.label === current?.label;
              return (
                <button
                  key={group.label} type="button" onClick={() => { onQuery(""); onArea(group.label); }}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  {group.label} {searching ? "" : `${enabledCount}/${total}`}
                </button>
              );
            })}
          </div>
          {!searching && current && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
              Área
              <Switch
                checked={current.pages.every((page) => profile.access[page.to])}
                onCheckedChange={(value) => {
                  for (const page of current.pages) {
                    if (Boolean(profile.access[page.to]) !== value) accessProfilesStore.setAccess(profile.id, page.to, value);
                  }
                }}
                aria-label={`Liberar a área ${current.label}`}
              />
            </div>
          )}
        </div>
      )}
      <div className="mt-3 flex-1 min-h-0 overflow-y-auto">
        {!profile ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <ShieldCheck className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">Salve o perfil para configurar as telas.</p>
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma tela encontrada para “{query}”.</p>
        ) : (
          <div className="space-y-4">
            {visible.map((group) => (
              <div key={group.label} className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                {searching && <div className="px-3 py-2 text-xs font-semibold bg-muted/40">{group.label}</div>}
                {group.pages.map((page) => {
                  const Icon = page.icon;
                  const enabled = profile.access[page.to] ?? false;
                  return (
                    <div key={page.to} className={`flex items-center gap-3 px-3 py-2 ${enabled ? "bg-card" : "bg-muted/30"}`}>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{page.label}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{page.description}</div>
                      </div>
                      <Switch checked={enabled} onCheckedChange={(value) => accessProfilesStore.setAccess(profile.id, page.to, value)} aria-label={`Acesso a ${page.label}`} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
