import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { WizardShell } from "@/components/erp-wizard";
import {
  CalendarDays, CheckCircle2, Sparkles, ArrowRight, ArrowLeft, X, Check,
  User, Palette, Bell, Mail, Plug, Activity, LayoutGrid, Zap, Users, Shield,
  Eye, KeyRound, Database, Languages, Server, Cloud, Sun, Moon, Monitor,
  Hash, Calendar, Code2, MessageSquare, Globe, Lock, Smartphone, FileText, Clock,
  SlidersHorizontal, type LucideIcon,
} from "lucide-react";
import wizardBg from "@/assets/wizard-bg.jpg";

export interface WizardOption { id: string; label: string; desc?: string; icon?: LucideIcon }
export interface WizardField { id: string; label: string; placeholder?: string; type?: string; defaultValue?: string; full?: boolean }
export interface WizardToggle { id: string; label: string; desc?: string; defaultChecked?: boolean }

type StepBase = { id: string; nav: string; navDesc: string; icon: LucideIcon; title: string; subtitle: string; when?: (sel: Record<string, string>) => boolean };

export type WizardStep =
  | (StepBase & { kind: "cards"; options: WizardOption[]; compact?: boolean })
  | (StepBase & { kind: "fields"; fields: WizardField[] | ((sel: Record<string, string>) => WizardField[]) })
  | (StepBase & { kind: "toggles"; toggles: WizardToggle[] });

export interface WizardConfig {
  title: string;
  heading: string;
  steps: WizardStep[];
}

export function SettingsWizard({ open, config, onClose, seed, onSave }: {
  open: boolean;
  config: WizardConfig;
  onClose: () => void;
  seed?: { selections?: Record<string, string>; values?: Record<string, string>; toggles?: Record<string, boolean>; presets?: Record<string, Record<string, string>> };
  onSave?: (payload: { selections: Record<string, string>; values: Record<string, string>; toggles: Record<string, boolean> }) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>(seed?.selections ?? {});
  const [values, setValues] = useState<Record<string, string>>(seed?.values ?? {});
  const [toggles, setToggles] = useState<Record<string, boolean>>(seed?.toggles ?? {});

  const selectedOf = (s: WizardStep & { kind: "cards" }) => selections[s.id] ?? s.options[0]?.id;
  const selMap = () => {
    const sel: Record<string, string> = {};
    config.steps.forEach(st => { if (st.kind === "cards") sel[st.id] = selectedOf(st); });
    return sel;
  };

  const visibleSteps = config.steps.filter(s => !s.when || s.when(selMap()));
  const allSteps = [
    ...visibleSteps,
    { kind: "review" as const, id: "__review", nav: "Revisão", navDesc: "Confirme e salve", icon: CheckCircle2, title: "Tudo certo?", subtitle: "Revise as configurações antes de salvar." },
  ];

  const fieldsOf = (s: WizardStep & { kind: "fields" }) => typeof s.fields === "function" ? s.fields(selMap()) : s.fields;
  const valueOf = (f: WizardField) => values[f.id] ?? f.defaultValue ?? "";
  const toggleOf = (t: WizardToggle) => toggles[t.id] ?? t.defaultChecked ?? false;
  const collect = () => {
    const nextValues: Record<string, string> = {};
    const nextToggles: Record<string, boolean> = {};
    for (const item of visibleSteps) {
      if (item.kind === "fields") for (const field of fieldsOf(item)) nextValues[field.id] = valueOf(field);
      if (item.kind === "toggles") for (const toggle of item.toggles) nextToggles[toggle.id] = toggleOf(toggle);
    }
    return { selections: selMap(), values: nextValues, toggles: nextToggles };
  };
  const finish = () => {
    if (step < allSteps.length - 1) { setStep(step + 1); return; }
    if (!onSave) { onClose(); return; }
    setBusy(true);
    void onSave(collect()).then(() => onClose()).catch(() => setBusy(false));
  };
  const current = allSteps[Math.min(step, allSteps.length - 1)];
  return <WizardShell open={open} onClose={onClose} badge={`Configurações · ${config.title}`} headline={config.heading} bg={wizardBg}
    steps={allSteps.map(s => ({ title: s.nav, desc: s.navDesc, icon: s.icon }))} step={Math.min(step, allSteps.length - 1)} setStep={busy ? () => undefined : setStep}
    footer={<><Button variant="outline" disabled={busy} onClick={step === 0 ? onClose : () => setStep(step - 1)}>{step === 0 ? "Cancelar" : "Voltar"}</Button><Button disabled={busy} onClick={finish}>{busy ? "Salvando..." : step < allSteps.length - 1 ? "Continuar" : "Salvar configurações"}</Button></>}>
    <h3 className="text-lg font-semibold">{current.title}</h3>
    {current.kind === "cards" && <div className="grid sm:grid-cols-2 gap-3">{current.options.map(o => { const Icon = o.icon ?? Sparkles; return <Button key={o.id} variant="outline" onClick={() => { setSelections(s => ({ ...s, [current.id]: o.id })); const preset = seed?.presets?.[o.id]; if (preset) setValues(v => ({ ...v, ...preset })); }} className={`h-auto whitespace-normal text-left justify-start p-5 gap-3 ${selectedOf(current) === o.id ? "border-primary bg-primary/5 ring-1 ring-primary" : ""}`}><Icon className="h-5 w-5 shrink-0" /><span><span className="block font-semibold">{o.label}</span><span className="block text-xs text-muted-foreground mt-1">{o.desc}</span></span></Button>; })}</div>}
    {current.kind === "fields" && <div className="grid sm:grid-cols-2 gap-4">{fieldsOf(current).map(f => <div key={f.id} className={f.full ? "sm:col-span-2" : ""}><Label htmlFor={`setting-${f.id}`}>{f.label}</Label><Input id={`setting-${f.id}`} className="mt-2 h-11" type={f.type ?? "text"} placeholder={f.placeholder} value={valueOf(f)} onChange={e => setValues(v => ({ ...v, [f.id]: e.target.value }))} /></div>)}</div>}
    {current.kind === "toggles" && <div className="divide-y divide-border">{current.toggles.map(t => <label key={t.id} className="flex items-center justify-between gap-4 py-4"><span><span className="block font-medium">{t.label}</span><span className="text-sm text-muted-foreground">{t.desc}</span></span><Switch checked={toggleOf(t)} onCheckedChange={v => setToggles(s => ({ ...s, [t.id]: v }))} /></label>)}</div>}
    {current.kind === "review" && <div className="divide-y divide-border">{visibleSteps.map(s => <section key={s.id} className="py-4 space-y-2"><h4 className="font-semibold">{s.nav}</h4>{s.kind === "cards" && <p>{s.options.find(o => o.id === selectedOf(s))?.label}</p>}{s.kind === "fields" && fieldsOf(s).map(f => <div key={f.id} className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">{f.label}</span><span className="break-all">{f.type === "password" ? "••••••••" : valueOf(f) || "—"}</span></div>)}{s.kind === "toggles" && s.toggles.map(t => <div key={t.id} className="flex justify-between gap-3 text-sm"><span>{t.label}</span><span>{toggleOf(t) ? "Ativado" : "Desativado"}</span></div>)}</section>)}</div>}
  </WizardShell>;
}

// ----------------------------------------------------------------------------
// Wizard configs per settings module
// ----------------------------------------------------------------------------

export const SETTINGS_WIZARDS: Record<string, WizardConfig> = {
  perfil: {
    title: "Perfil",
    heading: "Seus dados,\nsempre em dia.",
    steps: [
      { kind: "fields", id: "dados", nav: "Dados pessoais", navDesc: "Nome, e-mail e cargo", icon: User, title: "Quem é você?", subtitle: "Atualize suas informações pessoais.", fields: [
        { id: "nome", label: "Nome completo", defaultValue: "Maria Silva" },
        { id: "email", label: "E-mail", defaultValue: "maria@gruposorrisos.com" },
        { id: "cargo", label: "Cargo", defaultValue: "Gerente" },
        { id: "departamento", label: "Departamento", defaultValue: "Operações" },
        { id: "bio", label: "Bio", defaultValue: "Apaixonada por produtividade.", full: true },
      ]},
      { kind: "cards", id: "visibilidade", nav: "Visibilidade", navDesc: "Quem vê seu perfil", icon: Eye, title: "Quem pode ver seu perfil?", subtitle: "Defina a visibilidade das suas informações.", options: [
        { id: "equipe", label: "Toda a equipe", desc: "Todos os membros veem seu perfil completo", icon: Users },
        { id: "gestores", label: "Somente gestores", desc: "Apenas supervisores e acima", icon: Shield },
        { id: "privado", label: "Privado", desc: "Somente você e administradores", icon: Lock },
      ]},
    ],
  },
  aparencia: {
    title: "Aparência",
    heading: "Deixe a plataforma\ncom a sua cara.",
    steps: [
      { kind: "cards", id: "tema", nav: "Tema", navDesc: "Claro, escuro ou automático", icon: Palette, title: "Qual tema você prefere?", subtitle: "Escolha como a interface deve aparecer.", options: [
        { id: "claro", label: "Claro", desc: "Fundo claro, ideal para ambientes iluminados", icon: Sun },
        { id: "escuro", label: "Escuro", desc: "Conforto visual em baixa luminosidade", icon: Moon },
        { id: "auto", label: "Automático", desc: "Segue a preferência do sistema", icon: Monitor },
      ]},
      { kind: "toggles", id: "opcoes", nav: "Preferências", navDesc: "Densidade e animações", icon: SlidersHorizontal, title: "Ajustes visuais", subtitle: "Personalize o comportamento da interface.", toggles: [
        { id: "densidade", label: "Densidade compacta", desc: "Reduz espaçamentos para mostrar mais informação" },
        { id: "animacoes", label: "Animações", desc: "Ativa transições suaves na interface", defaultChecked: true },
        { id: "sidebar", label: "Sidebar sempre expandida", defaultChecked: true },
      ]},
    ],
  },
  notificacoes: {
    title: "Notificações",
    heading: "Receba só o que\nimporta para você.",
    steps: [
      { kind: "cards", id: "frequencia", nav: "Frequência", navDesc: "Quando notificar", icon: Bell, title: "Com que frequência?", subtitle: "Escolha o ritmo das suas notificações.", options: [
        { id: "instantaneo", label: "Instantâneo", desc: "Receba alertas no momento em que acontecem", icon: Zap },
        { id: "diario", label: "Resumo diário", desc: "Um resumo por dia às 18h", icon: Clock },
        { id: "semanal", label: "Resumo semanal", desc: "Toda segunda-feira às 08h", icon: Calendar },
      ]},
      { kind: "toggles", id: "canais", nav: "Alertas", navDesc: "O que notificar", icon: SlidersHorizontal, title: "Quais alertas ativar?", subtitle: "Ligue ou desligue cada tipo de notificação.", toggles: [
        { id: "atribuida", label: "Tarefa atribuída a mim", desc: "Quando alguém me marca em uma tarefa", defaultChecked: true },
        { id: "comentarios", label: "Comentários", desc: "Novos comentários em tarefas que sigo", defaultChecked: true },
        { id: "prazo", label: "Prazo se aproximando", desc: "Avisar 24h antes do vencimento", defaultChecked: true },
        { id: "concluida", label: "Tarefa concluída", desc: "Quando uma tarefa minha é concluída" },
        { id: "som", label: "Som de notificação", desc: "Tocar som ao receber alertas" },
      ]},
    ],
  },
  email: {
    title: "E-mail",
    heading: "Conecte o envio\nde e-mails.",
    steps: [
      { kind: "cards", id: "metodo", nav: "Método", navDesc: "API ou SMTP", icon: Mail, title: "Como você quer enviar?", subtitle: "Escolha entre conectar um serviço por API ou usar seu próprio servidor SMTP.", options: [
        { id: "api", label: "API", desc: "Conecte um serviço de envio (Resend, SendGrid, etc.) usando uma chave de API", icon: Zap },
        { id: "smtp", label: "SMTP", desc: "Use seu próprio servidor de e-mail com host, porta e credenciais", icon: Server },
      ]},
      { kind: "cards", id: "provedor", compact: true, when: (sel) => sel["metodo"] === "api", nav: "Provedor", navDesc: "Serviço de envio", icon: Cloud, title: "Qual provedor de API?", subtitle: "Selecione o serviço que será usado para enviar os e-mails da plataforma.", options: [
        { id: "resend", label: "Resend", desc: "API moderna para devs, ótima entregabilidade", icon: Zap },
        { id: "sendgrid", label: "SendGrid", desc: "Plataforma robusta da Twilio para alto volume", icon: Cloud },
        { id: "mailgun", label: "Mailgun", desc: "API flexível com validação e rotas de e-mail", icon: Globe },
        { id: "ses", label: "Amazon SES", desc: "Baixo custo e escala com infraestrutura AWS", icon: Database },
        { id: "postmark", label: "Postmark", desc: "Focado em e-mails transacionais ultrarrápidos", icon: FileText },
        { id: "brevo", label: "Brevo", desc: "E-mail, SMS e automação em uma só plataforma", icon: MessageSquare },
        { id: "mailjet", label: "Mailjet", desc: "Envio colaborativo com editor de templates", icon: Plug },
        { id: "sparkpost", label: "SparkPost", desc: "Análises avançadas e alta performance", icon: Activity },
        { id: "elastic", label: "Elastic Email", desc: "Custo acessível para grandes volumes", icon: Sparkles },
      ]},
      { kind: "fields", id: "dados", nav: "Credenciais", navDesc: "Dados de acesso", icon: KeyRound, title: "Dados de acesso", subtitle: "Preencha as credenciais de conexão.", fields: (sel) => {
        if (sel["metodo"] === "smtp") return [
          { id: "host", label: "Host SMTP", placeholder: "smtp.gruposorrisos.com", defaultValue: "smtp.gruposorrisos.com" },
          { id: "porta", label: "Porta", placeholder: "587", defaultValue: "587" },
          { id: "usuario", label: "Usuário", placeholder: "noreply@gruposorrisos.com", defaultValue: "noreply@gruposorrisos.com" },
          { id: "senha", label: "Senha", type: "password", placeholder: "••••••••" },
          { id: "seguranca", label: "Segurança (TLS/SSL)", placeholder: "TLS", defaultValue: "TLS" },
          { id: "remetente", label: "E-mail remetente", placeholder: "noreply@gruposorrisos.com" },
        ];
        const p = sel["provedor"];
        if (p === "ses") return [
          { id: "accesskey", label: "Access Key ID", placeholder: "AKIAXXXXXXXXXXXXXXXX" },
          { id: "secretkey", label: "Secret Access Key", type: "password", placeholder: "••••••••" },
          { id: "regiao", label: "Região AWS", placeholder: "us-east-1", defaultValue: "us-east-1" },
          { id: "remetente", label: "E-mail remetente", placeholder: "noreply@gruposorrisos.com" },
        ];
        const keyPlaceholder: Record<string, string> = {
          resend: "re_xxxxxxxxxxxx",
          sendgrid: "SG.xxxxxxxxxxxx",
          mailgun: "key-xxxxxxxxxxxx",
          postmark: "xxxxxxxx-xxxx-xxxx",
          brevo: "xkeysib-xxxxxxxx",
          mailjet: "xxxxxxxxxxxxxxxx",
          sparkpost: "xxxxxxxxxxxxxxxx",
          elastic: "xxxxxxxxxxxxxxxx",
        };
        const fields: WizardField[] = [
          { id: "apikey", label: "Chave de API", type: "password", placeholder: keyPlaceholder[p] ?? "Cole a chave aqui", full: true },
          { id: "remetente", label: "E-mail remetente", placeholder: "noreply@gruposorrisos.com" },
          { id: "nome", label: "Nome do remetente", placeholder: "Grupo Sorrisos", defaultValue: "Grupo Sorrisos" },
        ];
        if (p === "mailgun") fields.push({ id: "dominio", label: "Domínio de envio", placeholder: "mg.gruposorrisos.com", full: true });
        return fields;
      }},
      { kind: "toggles", id: "envios", nav: "Envios automáticos", navDesc: "Resumos e assinatura", icon: FileText, title: "Envios automáticos", subtitle: "Configure os e-mails recorrentes da plataforma.", toggles: [
        { id: "resumo", label: "Resumo semanal", desc: "Toda segunda-feira às 08h", defaultChecked: true },
        { id: "executivo", label: "Relatório executivo", desc: "Enviado à diretoria sexta-feira", defaultChecked: true },
        { id: "assinatura", label: "Assinatura HTML", desc: "Incluir logo e dados nos e-mails", defaultChecked: true },
      ]},
    ],
  },
  integracoes: {
    title: "Integrações",
    heading: "Conecte suas\nferramentas favoritas.",
    steps: [
      { kind: "cards", id: "servico", nav: "Serviço", navDesc: "Escolha a integração", icon: Plug, title: "O que você quer conectar?", subtitle: "Selecione o serviço para integrar à plataforma.", options: [
        { id: "slack", label: "Slack", desc: "Notificações e comandos no seu workspace", icon: Hash },
        { id: "gcal", label: "Google Calendar", desc: "Sincronize prazos com sua agenda", icon: Calendar },
        { id: "github", label: "GitHub", desc: "Vincule commits e pull requests às tarefas", icon: Code2 },
        { id: "teams", label: "Microsoft Teams", desc: "Alertas direto nos seus canais", icon: Globe },
        { id: "whatsapp", label: "WhatsApp Business", desc: "Avisos importantes por mensagem", icon: MessageSquare },
        { id: "webhook", label: "Webhook personalizado", desc: "Envie eventos para qualquer endpoint", icon: Plug },
      ]},
      { kind: "fields", id: "credenciais", nav: "Credenciais", navDesc: "Token ou endpoint", icon: KeyRound, title: "Dados de conexão", subtitle: "Informe as credenciais do serviço escolhido.", fields: (sel) => sel["servico"] === "webhook" ? [
        { id: "url", label: "URL do endpoint", placeholder: "https://api.exemplo.com/webhook", full: true },
        { id: "segredo", label: "Segredo de assinatura", type: "password", placeholder: "whsec_xxxx", full: true },
      ] : [
        { id: "token", label: "Token / Chave de acesso", type: "password", placeholder: "Cole o token aqui", full: true },
      ]},
    ],
  },
  atividades: {
    title: "Atividades",
    heading: "Histórico completo\nde tudo que acontece.",
    steps: [
      { kind: "toggles", id: "registros", nav: "Registros", navDesc: "O que registrar", icon: Activity, title: "O que deve ser registrado?", subtitle: "Controle o histórico de eventos da plataforma.", toggles: [
        { id: "historico", label: "Registrar histórico de tarefas", desc: "Salvar timeline de eventos", defaultChecked: true },
        { id: "logs", label: "Logs de acesso", desc: "Registrar entradas e saídas", defaultChecked: true },
        { id: "visualizou", label: "Mostrar quem visualizou", desc: "Exibir leitura por outros membros" },
      ]},
      { kind: "fields", id: "retencao", nav: "Retenção", navDesc: "Por quanto tempo", icon: Clock, title: "Por quanto tempo guardar?", subtitle: "Defina o período de retenção do histórico.", fields: [
        { id: "dias", label: "Retenção de histórico (dias)", defaultValue: "90" },
      ]},
    ],
  },
  kanban: {
    title: "Kanban & Cards",
    heading: "O quadro do jeito\nque o time trabalha.",
    steps: [
      { kind: "fields", id: "limites", nav: "Limites", navDesc: "WIP por coluna", icon: LayoutGrid, title: "Limite de trabalho", subtitle: "Controle quantos cards podem estar em andamento.", fields: [
        { id: "wip", label: "Limite WIP por coluna", defaultValue: "8" },
      ]},
      { kind: "toggles", id: "exibicao", nav: "Exibição", navDesc: "O que mostrar nos cards", icon: Eye, title: "O que mostrar nos cards?", subtitle: "Personalize as informações visíveis no quadro.", toggles: [
        { id: "capa", label: "Mostrar capa do card", desc: "Exibir imagem de destaque", defaultChecked: true },
        { id: "avatares", label: "Mostrar avatares", defaultChecked: true },
        { id: "checklist", label: "Mostrar checklist no card", defaultChecked: true },
        { id: "tags", label: "Mostrar tags coloridas", defaultChecked: true },
        { id: "prazo", label: "Mostrar prazo no card", defaultChecked: true },
        { id: "arquivar", label: "Auto-arquivar concluídos", desc: "Após 30 dias na coluna Concluído" },
      ]},
    ],
  },
  automacoes: {
    title: "Automações",
    heading: "Deixe a rotina\ntrabalhar sozinha.",
    steps: [
      { kind: "cards", id: "gatilho", nav: "Gatilho", navDesc: "Quando disparar", icon: Zap, title: "Quando a automação dispara?", subtitle: "Escolha o evento que inicia o fluxo.", options: [
        { id: "concluido", label: "Card movido para Concluído", desc: "Quando uma tarefa é finalizada", icon: CheckCircle2 },
        { id: "prazo", label: "Prazo vence em 24h", desc: "Um dia antes do vencimento", icon: Clock },
        { id: "comentario", label: "Novo comentário", desc: "Quando alguém comenta em uma tarefa", icon: MessageSquare },
        { id: "agendado", label: "Agendado", desc: "Em um horário fixo, ex.: toda sexta 17h", icon: Calendar },
      ]},
      { kind: "cards", id: "acao", nav: "Ação", navDesc: "O que fazer", icon: Sparkles, title: "O que deve acontecer?", subtitle: "Escolha a ação executada automaticamente.", options: [
        { id: "notificar", label: "Notificar autor", desc: "Envia notificação para quem criou", icon: Bell },
        { id: "urgente", label: "Marcar como Urgente", desc: "Eleva a prioridade da tarefa", icon: Zap },
        { id: "email", label: "Enviar e-mail", desc: "Dispara e-mail ao responsável", icon: Mail },
        { id: "resumo", label: "Gerar resumo", desc: "Cria relatório do período", icon: FileText },
      ]},
    ],
  },
  equipe: {
    title: "Equipe & Papéis",
    heading: "Regras claras para\no time crescer.",
    steps: [
      { kind: "toggles", id: "entrada", nav: "Entrada", navDesc: "Convites e aprovação", icon: Users, title: "Como novos membros entram?", subtitle: "Defina as regras de entrada na equipe.", toggles: [
        { id: "link", label: "Convidar por link", desc: "Permitir entrada por link de convite", defaultChecked: true },
        { id: "aprovacao", label: "Aprovação obrigatória", desc: "Admin precisa aprovar novos membros", defaultChecked: true },
      ]},
      { kind: "fields", id: "padroes", nav: "Padrões", navDesc: "Domínio e papel", icon: SlidersHorizontal, title: "Padrões da equipe", subtitle: "Configure o domínio permitido e o papel inicial.", fields: [
        { id: "dominio", label: "Domínio permitido", defaultValue: "@gruposorrisos.com" },
        { id: "papel", label: "Papel padrão", defaultValue: "Colaborador(a)" },
      ]},
    ],
  },
  seguranca: {
    title: "Segurança",
    heading: "Proteção máxima\npara sua conta.",
    steps: [
      { kind: "cards", id: "fator", nav: "2FA", navDesc: "Segundo fator", icon: Shield, title: "Autenticação em dois fatores", subtitle: "Escolha o método do segundo fator de login.", options: [
        { id: "app", label: "App autenticador", desc: "Google Authenticator, Authy e similares", icon: Smartphone },
        { id: "sms", label: "SMS", desc: "Código enviado por mensagem de texto", icon: MessageSquare },
        { id: "email2", label: "E-mail", desc: "Código enviado para seu e-mail", icon: Mail },
        { id: "off", label: "Desativado", desc: "Somente senha (não recomendado)", icon: Lock },
      ]},
      { kind: "fields", id: "sessao", nav: "Sessão", navDesc: "Expiração", icon: Clock, title: "Controle de sessão", subtitle: "Defina o tempo de inatividade antes do logout.", fields: [
        { id: "expira", label: "Sessão expira após (min)", defaultValue: "30" },
      ]},
      { kind: "toggles", id: "extras", nav: "Proteções", navDesc: "SSO e alertas", icon: Lock, title: "Proteções adicionais", subtitle: "Ative camadas extras de segurança.", toggles: [
        { id: "sso", label: "Login único (SSO)", desc: "Integração com SAML" },
        { id: "alertas", label: "Alertas de login suspeito", defaultChecked: true },
      ]},
    ],
  },
  privacidade: {
    title: "Privacidade",
    heading: "Você no controle\ndos seus dados.",
    steps: [
      { kind: "cards", id: "perfil", nav: "Perfil", navDesc: "Quem vê seus dados", icon: Eye, title: "Visibilidade do perfil", subtitle: "Escolha quem pode ver suas informações.", options: [
        { id: "equipe", label: "Toda a equipe", desc: "Visível para todos os membros", icon: Users },
        { id: "gestores", label: "Somente gestores", desc: "Apenas supervisores e acima", icon: Shield },
        { id: "privado", label: "Privado", desc: "Somente você e administradores", icon: Lock },
      ]},
      { kind: "toggles", id: "dados", nav: "Dados", navDesc: "Status e compartilhamento", icon: Database, title: "Compartilhamento de dados", subtitle: "Controle o que é exibido e compartilhado.", toggles: [
        { id: "online", label: "Mostrar status online", defaultChecked: true },
        { id: "indexacao", label: "Permitir indexação por buscadores" },
        { id: "anonimos", label: "Compartilhar dados de uso anônimos", defaultChecked: true },
      ]},
    ],
  },
  api: {
    title: "API & Webhooks",
    heading: "Integre tudo com\nnossos tokens.",
    steps: [
      { kind: "cards", id: "ambiente", nav: "Ambiente", navDesc: "Produção ou dev", icon: KeyRound, title: "Para qual ambiente?", subtitle: "Escolha onde o token será usado.", options: [
        { id: "producao", label: "Produção", desc: "Acesso aos dados reais da plataforma", icon: Globe },
        { id: "dev", label: "Desenvolvimento", desc: "Ambiente de testes e sandbox", icon: Code2 },
      ]},
      { kind: "fields", id: "token", nav: "Token", navDesc: "Identificação", icon: FileText, title: "Identifique o token", subtitle: "Dê um nome para reconhecer esse acesso depois.", fields: [
        { id: "nome", label: "Nome do token", placeholder: "Ex.: Integração ERP", full: true },
      ]},
    ],
  },
  backup: {
    title: "Backup & Dados",
    heading: "Seus dados sempre\nseguros e à mão.",
    steps: [
      { kind: "cards", id: "frequencia", nav: "Frequência", navDesc: "Quando fazer backup", icon: Database, title: "Com que frequência?", subtitle: "Escolha o intervalo dos backups automáticos.", options: [
        { id: "diario", label: "Diário", desc: "Todos os dias às 03h", icon: Clock },
        { id: "semanal", label: "Semanal", desc: "Todo domingo às 03h", icon: Calendar },
        { id: "mensal", label: "Mensal", desc: "Primeiro dia do mês", icon: CalendarDays },
      ]},
      { kind: "fields", id: "retencao", nav: "Retenção", navDesc: "Por quanto tempo", icon: Clock, title: "Retenção dos backups", subtitle: "Defina por quanto tempo manter cada backup.", fields: [
        { id: "dias", label: "Retenção (dias)", defaultValue: "30" },
        { id: "horario", label: "Horário do backup", defaultValue: "03:00" },
      ]},
    ],
  },
  idioma: {
    title: "Idioma & Região",
    heading: "A plataforma no\nseu idioma.",
    steps: [
      { kind: "cards", id: "idioma", nav: "Idioma", navDesc: "Língua da interface", icon: Languages, title: "Qual idioma usar?", subtitle: "Escolha a língua da interface.", options: [
        { id: "ptbr", label: "Português (BR)", desc: "Idioma atual da plataforma", icon: Globe },
        { id: "en", label: "English (US)", desc: "Interface em inglês americano", icon: Globe },
        { id: "es", label: "Español", desc: "Interface em espanhol", icon: Globe },
      ]},
      { kind: "fields", id: "regiao", nav: "Região", navDesc: "Fuso e formatos", icon: Clock, title: "Fuso horário e formatos", subtitle: "Ajuste a região e o formato de datas.", fields: [
        { id: "fuso", label: "Fuso horário", defaultValue: "America/Sao_Paulo" },
        { id: "formato", label: "Formato de data", defaultValue: "DD/MM/AAAA" },
      ]},
    ],
  },
  ia: {
    title: "IA & Sugestões",
    heading: "Inteligência para\nseu fluxo de trabalho.",
    steps: [
      { kind: "cards", id: "modo", nav: "Comportamento", navDesc: "Nível de proatividade", icon: Sparkles, title: "Como a IA deve agir?", subtitle: "Escolha o nível de proatividade do assistente.", options: [
        { id: "conservador", label: "Conservador", desc: "Sugere apenas quando solicitado", icon: Lock },
        { id: "equilibrado", label: "Equilibrado", desc: "Sugestões pontuais nos momentos certos", icon: SlidersHorizontal },
        { id: "proativo", label: "Proativo", desc: "Prioriza, resume e sugere automaticamente", icon: Zap },
      ]},
      { kind: "toggles", id: "recursos", nav: "Recursos", navDesc: "O que ativar", icon: Sparkles, title: "Recursos de IA", subtitle: "Ative as funcionalidades inteligentes.", toggles: [
        { id: "assistente", label: "Assistente de tarefas", desc: "Ajuda a descrever e dividir tarefas", defaultChecked: true },
        { id: "priorizacao", label: "Priorização automática", desc: "Sugere a ordem ideal de execução", defaultChecked: true },
        { id: "resumos", label: "Resumos semanais", desc: "Gera resumo inteligente da semana" },
      ]},
    ],
  },
};
