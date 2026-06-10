import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTheme, themeStore } from "@/lib/store";
import {
  User, Bell, Mail, Plug, Activity, LayoutGrid, Shield, Palette,
  Users, KeyRound, Database, Globe, Sparkles, ChevronRight, Check,
  Hash, Code2, Calendar, MessageSquare, Zap, Lock, Eye, Languages,
} from "lucide-react";

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
  { id: "email",        title: "E-mail",            desc: "Servidor SMTP, assinatura e digests",          icon: Mail,         hue: "from-sky-500/20 to-blue-500/10" },
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

  return (
    <AppShell title="Configurações" subtitle="Personalize toda a plataforma">
      <div className="p-4 md:p-8 max-w-7xl">
        {!active ? (
          <>
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
          </>
        ) : (
          <SectionDetail id={active} onBack={() => setActive(null)} />
        )}
      </div>
    </AppShell>
  );
}

function SectionDetail({ id, onBack }: { id: SectionId; onBack: () => void }) {
  const meta = SECTIONS.find(s => s.id === id)!;
  const Icon = meta.icon;
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>← Voltar</Button>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${meta.hue} border border-border/50 flex items-center justify-center`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold leading-tight">{meta.title}</h2>
            <p className="text-xs text-muted-foreground">{meta.desc}</p>
          </div>
        </div>
      </div>
      <Separator />
      <div className="max-w-3xl">{renderSection(id)}</div>
    </div>
  );
}

function renderSection(id: SectionId) {
  switch (id) {
    case "perfil": return <PerfilSec />;
    case "aparencia": return <AparenciaSec />;
    case "notificacoes": return <NotificacoesSec />;
    case "email": return <EmailSec />;
    case "integracoes": return <IntegracoesSec />;
    case "atividades": return <AtividadesSec />;
    case "kanban": return <KanbanSec />;
    case "automacoes": return <AutomacoesSec />;
    case "equipe": return <EquipeSec />;
    case "seguranca": return <SegurancaSec />;
    case "privacidade": return <PrivacidadeSec />;
    case "api": return <ApiSec />;
    case "backup": return <BackupSec />;
    case "idioma": return <IdiomaSec />;
    case "ia": return <IaSec />;
  }
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-t border-border first:border-0 first:pt-0">
      <div className="min-w-0">
        <Label>{label}</Label>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function PerfilSec() {
  return (
    <Card className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label>Nome</Label><Input defaultValue="Maria Silva" className="mt-1.5" /></div>
        <div><Label>Email</Label><Input defaultValue="maria@gruposorrisos.com" className="mt-1.5" /></div>
        <div><Label>Cargo</Label><Input defaultValue="Gerente" className="mt-1.5" /></div>
        <div><Label>Departamento</Label><Input defaultValue="Operações" className="mt-1.5" /></div>
        <div className="md:col-span-2"><Label>Bio</Label><Input defaultValue="Apaixonada por produtividade." className="mt-1.5" /></div>
      </div>
      <div className="flex justify-end mt-4"><Button>Salvar alterações</Button></div>
    </Card>
  );
}

function AparenciaSec() {
  const theme = useTheme();
  return (
    <Card className="p-6 space-y-2">
      <Row label="Tema escuro" desc="Use o modo escuro durante o dia ou noite">
        <Switch checked={theme === "dark"} onCheckedChange={() => themeStore.toggle()} />
      </Row>
      <Row label="Densidade compacta" desc="Reduz espaçamentos para mostrar mais informação"><Switch /></Row>
      <Row label="Animações" desc="Ativa transições suaves na interface"><Switch defaultChecked /></Row>
      <Row label="Sidebar sempre expandida"><Switch defaultChecked /></Row>
    </Card>
  );
}

function NotificacoesSec() {
  return (
    <Card className="p-6 space-y-2">
      {[
        ["Tarefa atribuída a mim", "Quando alguém me marca em uma tarefa", true],
        ["Comentários", "Novos comentários em tarefas que sigo", true],
        ["Prazo se aproximando", "Avisar 24h antes do vencimento", true],
        ["Tarefa concluída", "Quando uma tarefa minha é concluída", false],
        ["Som de notificação", "Tocar som ao receber alertas", false],
        ["Resumo diário", "Receber resumo às 18h", true],
      ].map(([l, d, c]) => (
        <Row key={l as string} label={l as string} desc={d as string}><Switch defaultChecked={c as boolean} /></Row>
      ))}
    </Card>
  );
}

function EmailSec() {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h4 className="font-semibold mb-4">Servidor SMTP</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Host</Label><Input defaultValue="smtp.gruposorrisos.com" className="mt-1.5" /></div>
          <div><Label>Porta</Label><Input defaultValue="587" className="mt-1.5" /></div>
          <div><Label>Usuário</Label><Input defaultValue="noreply@gruposorrisos.com" className="mt-1.5" /></div>
          <div><Label>Senha</Label><Input type="password" defaultValue="••••••••" className="mt-1.5" /></div>
        </div>
      </Card>
      <Card className="p-6 space-y-2">
        <Row label="Resumo semanal" desc="Toda segunda-feira às 08h"><Switch defaultChecked /></Row>
        <Row label="Relatório executivo" desc="Enviado à diretoria sexta-feira"><Switch defaultChecked /></Row>
        <Row label="Assinatura HTML" desc="Incluir logo e dados nos emails"><Switch defaultChecked /></Row>
      </Card>
    </div>
  );
}

function IntegracoesSec() {
  const items = [
    { name: "Slack", icon: Slack, status: "Conectado" },
    { name: "Google Calendar", icon: Calendar, status: "Conectado" },
    { name: "GitHub", icon: Github, status: "Desconectado" },
    { name: "WhatsApp Business", icon: MessageSquare, status: "Em breve" },
    { name: "Microsoft Teams", icon: Globe, status: "Desconectado" },
    { name: "Webhook personalizado", icon: Plug, status: "Conectado" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map(i => {
        const I = i.icon;
        const ok = i.status === "Conectado";
        return (
          <Card key={i.name} className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><I className="h-5 w-5" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{i.name}</div>
              <div className={`text-xs ${ok ? "text-emerald-500" : "text-muted-foreground"}`}>
                {ok && <Check className="inline h-3 w-3 mr-1" />}{i.status}
              </div>
            </div>
            <Button size="sm" variant={ok ? "outline" : "default"} disabled={i.status === "Em breve"}>
              {ok ? "Gerenciar" : "Conectar"}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}

function AtividadesSec() {
  return (
    <Card className="p-6 space-y-2">
      <Row label="Registrar histórico de tarefas" desc="Salvar timeline de eventos"><Switch defaultChecked /></Row>
      <Row label="Logs de acesso" desc="Registrar entradas e saídas"><Switch defaultChecked /></Row>
      <Row label="Mostrar quem visualizou" desc="Exibir leitura por outros membros"><Switch /></Row>
      <Row label="Retenção de histórico"><Input defaultValue="90 dias" className="w-32" /></Row>
    </Card>
  );
}

function KanbanSec() {
  return (
    <Card className="p-6 space-y-2">
      <Row label="Limite WIP por coluna" desc="Máximo de cards em andamento"><Input defaultValue="8" className="w-24" /></Row>
      <Row label="Mostrar capa do card" desc="Exibir imagem de destaque"><Switch defaultChecked /></Row>
      <Row label="Mostrar avatares"><Switch defaultChecked /></Row>
      <Row label="Mostrar checklist no card"><Switch defaultChecked /></Row>
      <Row label="Mostrar tags coloridas"><Switch defaultChecked /></Row>
      <Row label="Mostrar prazo no card"><Switch defaultChecked /></Row>
      <Row label="Auto-arquivar concluídos" desc="Após 30 dias na coluna Concluído"><Switch /></Row>
      <Row label="Drag & drop em mobile"><Switch defaultChecked /></Row>
    </Card>
  );
}

function AutomacoesSec() {
  return (
    <Card className="p-6">
      <div className="space-y-3">
        {[
          "Quando card move para 'Concluído' → notificar autor",
          "Quando prazo vence em 24h → marcar como Urgente",
          "Quando comentário adicionado → enviar email ao responsável",
          "Toda sexta 17h → gerar resumo semanal",
        ].map(r => (
          <div key={r} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-2 text-sm"><Zap className="h-4 w-4 text-amber-500" />{r}</div>
            <Switch defaultChecked />
          </div>
        ))}
      </div>
      <Button className="mt-4 w-full" variant="outline">+ Nova automação</Button>
    </Card>
  );
}

function EquipeSec() {
  return (
    <Card className="p-6 space-y-2">
      <Row label="Convidar por link" desc="Permitir entrada por link de convite"><Switch defaultChecked /></Row>
      <Row label="Aprovação obrigatória" desc="Admin precisa aprovar novos membros"><Switch defaultChecked /></Row>
      <Row label="Domínio permitido"><Input defaultValue="@gruposorrisos.com" className="w-56" /></Row>
      <Row label="Papel padrão"><Input defaultValue="Membro" className="w-32" /></Row>
    </Card>
  );
}

function SegurancaSec() {
  return (
    <Card className="p-6 space-y-2">
      <Row label="Autenticação em dois fatores (2FA)" desc="Adiciona uma camada extra de segurança"><Switch /></Row>
      <Row label="Sessão expira após" desc="Tempo de inatividade"><Input defaultValue="30 min" className="w-32" /></Row>
      <Row label="Login único (SSO)" desc="Integração com SAML"><Switch /></Row>
      <Row label="Alertas de login suspeito"><Switch defaultChecked /></Row>
      <div className="pt-4"><Button variant="outline"><Lock className="h-4 w-4 mr-2" />Alterar senha</Button></div>
    </Card>
  );
}

function PrivacidadeSec() {
  return (
    <Card className="p-6 space-y-2">
      <Row label="Perfil visível para equipe"><Switch defaultChecked /></Row>
      <Row label="Mostrar status online"><Switch defaultChecked /></Row>
      <Row label="Permitir indexação por buscadores"><Switch /></Row>
      <Row label="Compartilhar dados de uso anônimos"><Switch defaultChecked /></Row>
    </Card>
  );
}

function ApiSec() {
  return (
    <Card className="p-6">
      <h4 className="font-semibold mb-3">Tokens de acesso</h4>
      <div className="space-y-2">
        {["Token de produção", "Token de desenvolvimento"].map(t => (
          <div key={t} className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1"><div className="text-sm font-medium">{t}</div><div className="text-xs text-muted-foreground font-mono">sk_live_••••••••••••4f2a</div></div>
            <Button size="sm" variant="outline">Revogar</Button>
          </div>
        ))}
      </div>
      <Button className="mt-4">+ Gerar novo token</Button>
    </Card>
  );
}

function BackupSec() {
  return (
    <Card className="p-6 space-y-2">
      <Row label="Backup automático" desc="Diário às 03h"><Switch defaultChecked /></Row>
      <Row label="Retenção de backups"><Input defaultValue="30 dias" className="w-32" /></Row>
      <div className="pt-4 flex gap-2">
        <Button variant="outline">Exportar dados (.json)</Button>
        <Button variant="outline">Importar dados</Button>
      </div>
    </Card>
  );
}

function IdiomaSec() {
  return (
    <Card className="p-6 space-y-2">
      <Row label="Idioma"><Input defaultValue="Português (Brasil)" className="w-56" /></Row>
      <Row label="Fuso horário"><Input defaultValue="America/Sao_Paulo" className="w-56" /></Row>
      <Row label="Formato de data"><Input defaultValue="DD/MM/AAAA" className="w-40" /></Row>
      <Row label="Primeiro dia da semana"><Input defaultValue="Segunda" className="w-32" /></Row>
    </Card>
  );
}

function IaSec() {
  return (
    <Card className="p-6 space-y-2">
      <Row label="Assistente IA ativo" desc="Sugestões inteligentes na plataforma"><Switch defaultChecked /></Row>
      <Row label="Sugerir prioridades" desc="IA analisa e sugere prioridade das tarefas"><Switch defaultChecked /></Row>
      <Row label="Sugerir prazos realistas"><Switch defaultChecked /></Row>
      <Row label="Identificar gargalos" desc="Detectar pontos de bloqueio na operação"><Switch defaultChecked /></Row>
      <Row label="Resumo automático do dia"><Switch defaultChecked /></Row>
      <Row label="Redistribuição inteligente" desc="Sugerir reatribuição quando sobrecarregado"><Switch /></Row>
    </Card>
  );
}
