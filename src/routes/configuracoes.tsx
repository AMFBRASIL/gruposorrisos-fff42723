import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import {
  User, Bell, Mail, Plug, Activity, LayoutGrid, Shield, Palette,
  Users, KeyRound, Database, Sparkles, ChevronRight, Zap, Eye, Languages,
} from "lucide-react";
import { SettingsWizard, SETTINGS_WIZARDS } from "@/components/settings-wizard";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [
    { title: "Configurações — Grupo Sorrisos Tasks" },
    { name: "description", content: "Preferências do sistema." },
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
  hue: string;
};

const SECTIONS: Section[] = [
  { id: "perfil",       title: "Perfil",            desc: "Suas informações pessoais e cargo",            icon: User,         hue: "from-blue-500/20 to-cyan-500/10" },
  { id: "aparencia",    title: "Aparência",         desc: "Tema, densidade e personalização visual",      icon: Palette,      hue: "from-fuchsia-500/20 to-pink-500/10" },
  { id: "notificacoes", title: "Notificações",      desc: "Alertas, sons e canais ativos",                icon: Bell,         hue: "from-amber-500/20 to-orange-500/10" },
  { id: "email",        title: "E-mail",            desc: "Envio por API ou SMTP, assinatura e digests",  icon: Mail,         hue: "from-sky-500/20 to-blue-500/10" },
  { id: "integracoes",  title: "Integrações",       desc: "Slack, Google, GitHub, WhatsApp e mais",       icon: Plug,         badge: "8", hue: "from-emerald-500/20 to-teal-500/10" },
  { id: "atividades",   title: "Atividades",        desc: "Histórico, logs e timeline de eventos",        icon: Activity,     hue: "from-violet-500/20 to-purple-500/10" },
  { id: "kanban",       title: "Kanban & Cards",    desc: "Colunas, WIP, capa e campos exibidos",         icon: LayoutGrid,   hue: "from-indigo-500/20 to-blue-500/10" },
  { id: "automacoes",   title: "Automações",        desc: "Regras, gatilhos e fluxos automáticos",        icon: Zap,          badge: "Beta", hue: "from-yellow-500/20 to-amber-500/10" },
  { id: "equipe",       title: "Equipe & Papéis",   desc: "Membros, permissões e departamentos",          icon: Users,        hue: "from-rose-500/20 to-pink-500/10" },
  { id: "seguranca",    title: "Segurança",         desc: "Senha, 2FA e sessões ativas",                  icon: Shield,       hue: "from-red-500/20 to-rose-500/10" },
  { id: "privacidade",  title: "Privacidade",       desc: "Visibilidade do perfil e dados",               icon: Eye,          hue: "from-slate-500/20 to-zinc-500/10" },
  { id: "api",          title: "API & Webhooks",    desc: "Tokens de acesso e endpoints",                 icon: KeyRound,     hue: "from-lime-500/20 to-green-500/10" },
  { id: "backup",       title: "Backup & Dados",    desc: "Exportar, importar e retenção",                icon: Database,     hue: "from-cyan-500/20 to-sky-500/10" },
  { id: "idioma",       title: "Idioma & Região",   desc: "Idioma, fuso horário e formato",               icon: Languages,    hue: "from-teal-500/20 to-emerald-500/10" },
  { id: "ia",           title: "IA & Sugestões",    desc: "Assistente, priorização e resumos",            icon: Sparkles,     badge: "Novo", hue: "from-purple-500/20 to-fuchsia-500/10" },
];

function SettingsPage() {
  const [active, setActive] = useState<SectionId | null>(null);
  const config = active ? SETTINGS_WIZARDS[active] : null;

  return (
    <AppShell title="Configurações" subtitle="Personalize toda a plataforma" primaryAction={null}>
      <div className="p-4 md:p-8 max-w-7xl">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">O que você quer ajustar?</h2>
          <p className="text-sm text-muted-foreground">Escolha uma categoria para configurar</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className="group relative text-left rounded-2xl border border-border bg-card p-5 overflow-hidden transition-all hover:border-primary/40 hover:shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.3)] hover:-translate-y-0.5"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${s.hue} opacity-60 group-hover:opacity-100 transition-opacity`} />
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-11 w-11 rounded-xl bg-background/80 backdrop-blur border border-border/50 flex items-center justify-center shadow-sm">
                      <Icon className="h-5 w-5 text-foreground" />
                    </div>
                    {s.badge && <Badge variant="secondary" className="text-[10px]">{s.badge}</Badge>}
                  </div>
                  <h3 className="font-semibold leading-tight">{s.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.desc}</p>
                  <div className="mt-4 flex items-center text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Configurar <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {config && (
        <SettingsWizard
          key={active}
          open={!!active}
          config={config}
          onClose={() => setActive(null)}
        />
      )}
    </AppShell>
  );
}
