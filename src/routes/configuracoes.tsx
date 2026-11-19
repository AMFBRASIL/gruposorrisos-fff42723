import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import {
  User, Bell, Mail, Plug, Activity, LayoutGrid, Shield, Palette,
  Users, KeyRound, Database, Sparkles, ChevronRight, Zap, Eye, Languages, GitBranch,
} from "lucide-react";
import { SettingsWizard, SETTINGS_WIZARDS } from "@/components/settings-wizard";
import { OrderWorkflowDialog } from "@/components/order-workflow";
import { ApiError } from "@/lib/api";
import { reloadSessionUser } from "@/lib/auth";
import { saveSettings, useSettings, wizardSeed } from "@/lib/settings";
import { useProcurementSession } from "@/lib/procurement-live";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [
    { title: "Configurações — Grupo Sorrisos Tasks" },
    { name: "description", content: "Preferências do sistema." },
    { property: "og:title", content: "Configurações — Grupo Sorrisos Tasks" },
    { property: "og:description", content: "Preferências do sistema." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: SettingsPage,
});

type SectionId =
  | "perfil" | "aparencia" | "notificacoes" | "email" | "integracoes"
  | "atividades" | "kanban" | "automacoes" | "equipe" | "seguranca"
  | "privacidade" | "api" | "backup" | "idioma" | "ia";

type Section = {
  id: SectionId;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  group: "Conta" | "Workspace" | "Plataforma" | "Avançado";
};

const SECTIONS: Section[] = [
  { id: "perfil",       title: "Perfil",            desc: "Suas informações pessoais e cargo",            icon: User,       group: "Conta" },
  { id: "aparencia",    title: "Aparência",         desc: "Tema, densidade e personalização visual",      icon: Palette,    group: "Conta" },
  { id: "notificacoes", title: "Notificações",      desc: "Alertas, sons e canais ativos",                icon: Bell,       group: "Conta" },
  { id: "idioma",       title: "Idioma & Região",   desc: "Idioma, fuso horário e formato",               icon: Languages,  group: "Conta" },

  { id: "equipe",       title: "Equipe & Papéis",   desc: "Membros, permissões e departamentos",          icon: Users,      group: "Workspace" },
  { id: "kanban",       title: "Kanban & Cards",    desc: "Colunas, WIP, capa e campos exibidos",         icon: LayoutGrid, group: "Workspace" },
  { id: "automacoes",   title: "Automações",        desc: "Regras, gatilhos e fluxos automáticos",        icon: Zap,        badge: "Beta", group: "Workspace" },
  { id: "atividades",   title: "Atividades",        desc: "Histórico, logs e timeline de eventos",        icon: Activity,   group: "Workspace" },

  { id: "email",        title: "E-mail",            desc: "Envio por API ou SMTP, assinatura e digests",  icon: Mail,       group: "Plataforma" },
  { id: "integracoes",  title: "Integrações",       desc: "Slack, Google, GitHub, WhatsApp e mais",       icon: Plug,       badge: "8 ativas", group: "Plataforma" },
  { id: "ia",           title: "IA & Sugestões",    desc: "Assistente, priorização e resumos",            icon: Sparkles,   badge: "Novo", group: "Plataforma" },
  { id: "api",          title: "API & Webhooks",    desc: "Tokens de acesso e endpoints",                 icon: KeyRound,   group: "Plataforma" },

  { id: "seguranca",    title: "Segurança",         desc: "Senha, 2FA e sessões ativas",                  icon: Shield,     group: "Avançado" },
  { id: "privacidade",  title: "Privacidade",       desc: "Visibilidade do perfil e dados",               icon: Eye,        group: "Avançado" },
  { id: "backup",       title: "Backup & Dados",    desc: "Exportar, importar e retenção",                icon: Database,   group: "Avançado" },
];

const GROUPS: Array<Section["group"]> = ["Conta", "Workspace", "Plataforma", "Avançado"];

function badgeFor(section: Section, integrations: number | undefined) {
  if (section.id !== "integracoes") return section.badge;
  if (integrations == null) return section.badge;
  return integrations === 1 ? "1 ativa" : `${integrations} ativas`;
}

function SettingsPage() {
  const [active, setActive] = useState<SectionId | null>(null);
  const [stagesOpen, setStagesOpen] = useState(false);
  const session = useProcurementSession();
  const settings = useSettings();
  const config = active ? SETTINGS_WIZARDS[active] : null;

  const saveModule = async (module: SectionId, payload: { selections: Record<string, string>; values: Record<string, string>; toggles: Record<string, boolean> }) => {
    try {
      const result = await saveSettings(module, payload);
      if (module === "perfil") await reloadSessionUser();
      if (result.secret) toast.success(result.notice ?? "Configuração salva.", { description: result.secret, duration: 60000 });
      else if (result.notice) toast.success(result.notice);
      else toast.success("Configurações salvas.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Não foi possível salvar.");
      throw error;
    }
  };

  return (
    <AppShell title="Configurações" subtitle="Personalize toda a plataforma" primaryAction={null}>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">Preferências do sistema</h2>
          <p className="text-sm text-muted-foreground">Selecione uma área para configurar.</p>
        </div>

        {GROUPS.map(group => {
          const items = SECTIONS.filter(s => s.group === group);
          const extra = group === "Workspace" && session.can("usuarios.gerenciar") ? 1 : 0;
          const count = items.length + extra;
          return (
            <section key={group} className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</h3>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-muted-foreground">{count} {count === 1 ? "item" : "itens"}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(s => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActive(s.id)}
                      className="group relative text-left rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/50 hover:bg-accent/30 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <div className="flex items-start gap-4">
                        <div className="h-11 w-11 shrink-0 rounded-md border border-border bg-muted/60 flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:border-primary/40 transition-colors">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm leading-tight truncate">{s.title}</h4>
                            {badgeFor(s, settings?.integrations.active) && <Badge variant="secondary" className="text-[10px] font-normal">{badgeFor(s, settings?.integrations.active)}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.desc}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    </button>
                  );
                })}
                {group === "Workspace" && session.can("usuarios.gerenciar") && (
                  <button type="button" onClick={() => setStagesOpen(true)} className="group relative text-left rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/50 hover:bg-accent/30 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                    <div className="flex items-start gap-4">
                      <div className="h-11 w-11 shrink-0 rounded-md border border-border bg-muted/60 flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:border-primary/40 transition-colors"><GitBranch className="h-5 w-5" /></div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm leading-tight">Etapas do pedido</h4>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">Nomes, cores, responsáveis e ordem das etapas de compra</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {stagesOpen && <OrderWorkflowDialog onClose={() => setStagesOpen(false)} />}
      {config && active && (
        <SettingsWizard
          key={active}
          open={!!active}
          config={config}
          seed={settings ? wizardSeed(active, settings) : undefined}
          onClose={() => setActive(null)}
          onSave={(payload) => saveModule(active, payload)}
        />
      )}
    </AppShell>
  );
}
