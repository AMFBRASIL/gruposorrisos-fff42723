import { useEffect, useState } from "react";
import { Bell, FileCheck2, Languages, Lock, Palette, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FieldLabel, OptionCard, ReviewGrid, WizardFooter, WizardShell, selectCls } from "@/components/erp-wizard";
import { ApiError, apiRequest } from "@/lib/api";
import { getAccessToken, reloadSessionUser, useAuth } from "@/lib/auth";
import { loadSettings, saveSettings, useSettings, type SettingsSnapshot } from "@/lib/settings";

const COLORS = ["#2563eb", "#0f766e", "#b45309", "#be123c", "#6d28d9", "#334155"];

const THEMES = [
  { id: "claro", title: "Claro", desc: "Fundo claro" },
  { id: "escuro", title: "Escuro", desc: "Baixa luminosidade" },
  { id: "auto", title: "Automático", desc: "Segue o sistema" },
] as const;

const FREQUENCIES = [
  { id: "instantaneo", title: "Instantâneo", desc: "No momento do evento" },
  { id: "diario", title: "Resumo diário", desc: "Um resumo por dia" },
  { id: "semanal", title: "Resumo semanal", desc: "Toda segunda-feira" },
] as const;

const VISIBILITY = [
  { id: "equipe", title: "Toda a equipe", desc: "Membros veem o perfil" },
  { id: "gestores", title: "Somente gestores", desc: "Supervisores e acima" },
  { id: "privado", title: "Privado", desc: "Você e administradores" },
] as const;

const LANGUAGES = [
  { id: "ptbr", title: "Português" },
  { id: "en", title: "English" },
  { id: "es", title: "Español" },
] as const;

const FACTORS = [
  { id: "app", title: "App autenticador", desc: "Google Authenticator e similares" },
  { id: "sms", title: "SMS", desc: "Código por mensagem" },
  { id: "email2", title: "E-mail", desc: "Código no e-mail" },
  { id: "off", title: "Desativado", desc: "Somente senha" },
] as const;

type Form = {
  nome: string; email: string; cargo: string; departamento: string; bio: string; iniciais: string; cor: string;
  tema: string; densidade: boolean; animacoes: boolean; sidebar: boolean;
  frequencia: string; atribuida: boolean; comentarios: boolean; prazo: boolean; concluida: boolean; som: boolean;
  idioma: string; fuso: string; formato: string;
  visibilidade: string; online: boolean; indexacao: boolean; anonimos: boolean;
  fator: string; expira: string;
  senhaAtual: string; senhaNova: string; senhaConfirmacao: string;
};

const STEPS = [
  { title: "Identificação", desc: "Nome, cargo e como você aparece", icon: User },
  { title: "Preferências", desc: "Tema, avisos e ritmo das notificações", icon: Palette },
  { title: "Idioma e privacidade", desc: "Região e quem vê o seu perfil", icon: Languages },
  { title: "Segurança", desc: "Senha, segundo fator e sessão", icon: Shield },
  { title: "Revisão", desc: "Conferir antes de salvar", icon: FileCheck2 },
];

function labelOf(options: readonly { id: string; title: string }[], id: string) {
  return options.find((option) => option.id === id)?.title ?? id;
}

function seed(snapshot: SettingsSnapshot, person: { initials: string; color: string }): Form {
  return {
    nome: snapshot.profile.nome,
    email: snapshot.profile.email,
    cargo: snapshot.profile.cargo,
    departamento: snapshot.profile.departamento,
    bio: snapshot.profile.bio,
    iniciais: person.initials,
    cor: person.color || COLORS[0],
    tema: snapshot.appearance.tema || "claro",
    densidade: snapshot.appearance.densidade,
    animacoes: snapshot.appearance.animacoes,
    sidebar: snapshot.appearance.sidebar,
    frequencia: snapshot.notifications.frequencia || "instantaneo",
    atribuida: snapshot.notifications.atribuida,
    comentarios: snapshot.notifications.comentarios,
    prazo: snapshot.notifications.prazo,
    concluida: snapshot.notifications.concluida,
    som: snapshot.notifications.som,
    idioma: snapshot.locale.idioma || "ptbr",
    fuso: snapshot.locale.fuso || "America/Sao_Paulo",
    formato: snapshot.locale.formato || "DD/MM/AAAA",
    visibilidade: snapshot.privacy.perfil || snapshot.profile.visibilidade || "equipe",
    online: snapshot.privacy.online,
    indexacao: snapshot.privacy.indexacao,
    anonimos: snapshot.privacy.anonimos,
    fator: snapshot.security.fator || "off",
    expira: snapshot.security.expira || "15",
    senhaAtual: "",
    senhaNova: "",
    senhaConfirmacao: "",
  };
}

function emailOk(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function passwordIssue(form: Form) {
  const filled = form.senhaAtual || form.senhaNova || form.senhaConfirmacao;
  if (!filled) return null;
  if (!form.senhaAtual.trim()) return "Informe a senha atual.";
  if (form.senhaNova.trim().length < 8) return "A nova senha precisa ter ao menos 8 caracteres.";
  if (form.senhaNova !== form.senhaConfirmacao) return "A confirmação não confere com a nova senha.";
  return null;
}

function sessionIssue(value: string) {
  const minutes = Number(value.trim());
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) return "Informe entre 5 e 1440 minutos.";
  return null;
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {desc && <span className="block text-xs text-muted-foreground mt-0.5">{desc}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function AccountWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const auth = useAuth();
  const settings = useSettings();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(null);
      return;
    }
    setStep(0);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (open && !settings) void loadSettings();
  }, [open, settings]);

  useEffect(() => {
    const person = auth.user;
    if (!open || !settings || !person) return;
    setForm((current) => current ?? seed(settings, person));
  }, [open, settings, auth.user]);

  if (!open) return null;

  const patch = (partial: Partial<Form>) => setForm((current) => current ? { ...current, ...partial } : current);
  const identityOk = !!form && form.nome.trim().length >= 2 && emailOk(form.email);
  const securityOk = !!form && !passwordIssue(form) && !sessionIssue(form.expira);
  const canNext = !busy && (step === 0 ? identityOk : step === 3 ? securityOk : !!form);

  async function finish() {
    if (!form || !settings || !identityOk || !securityOk) return;
    setBusy(true);
    setError(null);
    try {
      await saveSettings("perfil", {
        values: {
          nome: form.nome.trim(),
          email: form.email.trim(),
          cargo: form.cargo.trim(),
          departamento: form.departamento.trim(),
          bio: form.bio.trim(),
          iniciais: form.iniciais.trim(),
          cor: form.cor,
        },
        selections: { visibilidade: form.visibilidade },
        toggles: {},
      });
      await saveSettings("aparencia", {
        values: {},
        selections: { tema: form.tema },
        toggles: { densidade: form.densidade, animacoes: form.animacoes, sidebar: form.sidebar },
      });
      await saveSettings("notificacoes", {
        values: {},
        selections: { frequencia: form.frequencia },
        toggles: { atribuida: form.atribuida, comentarios: form.comentarios, prazo: form.prazo, concluida: form.concluida, som: form.som },
      });
      await saveSettings("idioma", {
        values: { fuso: form.fuso.trim(), formato: form.formato.trim() },
        selections: { idioma: form.idioma },
        toggles: {},
      });
      await saveSettings("privacidade", {
        values: {},
        selections: { perfil: form.visibilidade },
        toggles: { online: form.online, indexacao: form.indexacao, anonimos: form.anonimos },
      });
      const security = await saveSettings("seguranca", {
        values: { expira: form.expira.trim() },
        selections: { fator: form.fator },
        toggles: { sso: settings.security.sso, alertas: settings.security.alertas },
      });
      if (form.senhaNova) {
        await apiRequest("/api/auth/password", {
          method: "POST",
          body: JSON.stringify({ currentPassword: form.senhaAtual, newPassword: form.senhaNova }),
        }, getAccessToken());
      }
      await reloadSessionUser();
      if (security.secret) toast.success(security.notice ?? "Dados atualizados.", { description: security.secret, duration: 60000 });
      else toast.success("Dados da conta atualizados.");
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não foi possível salvar os dados.");
    } finally {
      setBusy(false);
    }
  }

  const colors = form && !COLORS.includes(form.cor) ? [form.cor, ...COLORS] : COLORS;

  return (
    <WizardShell
      open={open}
      onClose={onClose}
      badge="Minha conta"
      headline={<>Seus dados,<br />do seu jeito.</>}
      sub={auth.user?.profileName ?? "Usuário atual"}
      steps={STEPS}
      step={step}
      setStep={setStep}
      footer={<WizardFooter step={step} last={STEPS.length - 1} onClose={onClose} setStep={setStep} onFinish={() => { void finish(); }} finishLabel={busy ? "Salvando..." : "Salvar dados"} canNext={canNext} />}
    >
      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      {!form && <p className="text-sm text-muted-foreground">Carregando os dados da conta...</p>}
      {form && step === 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FieldLabel>Nome completo</FieldLabel>
            <Input value={form.nome} onChange={(event) => patch({ nome: event.target.value })} />
          </div>
          <div>
            <FieldLabel>E-mail</FieldLabel>
            <Input type="email" value={form.email} onChange={(event) => patch({ email: event.target.value })} />
          </div>
          <div>
            <FieldLabel>Iniciais</FieldLabel>
            <Input value={form.iniciais} maxLength={4} onChange={(event) => patch({ iniciais: event.target.value.toUpperCase() })} />
          </div>
          <div>
            <FieldLabel>Cargo</FieldLabel>
            <Input value={form.cargo} onChange={(event) => patch({ cargo: event.target.value })} />
          </div>
          <div>
            <FieldLabel>Departamento</FieldLabel>
            <Input value={form.departamento} onChange={(event) => patch({ departamento: event.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>Bio</FieldLabel>
            <Textarea value={form.bio} rows={4} onChange={(event) => patch({ bio: event.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>Cor do avatar</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button key={color} type="button" aria-label={`Cor ${color}`} onClick={() => patch({ cor: color })} className={`h-9 w-9 rounded-full border-2 ${form.cor === color ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: color }} />
              ))}
            </div>
          </div>
        </div>
      )}
      {form && step === 1 && (
        <div className="space-y-6">
          <div>
            <FieldLabel>Tema</FieldLabel>
            <div className="grid sm:grid-cols-3 gap-3">
              {THEMES.map((theme) => <OptionCard key={theme.id} compact selected={form.tema === theme.id} title={theme.title} desc={theme.desc} icon={Palette} onClick={() => patch({ tema: theme.id })} />)}
            </div>
          </div>
          <div className="space-y-2">
            <ToggleRow label="Densidade compacta" desc="Reduz espaçamentos da interface" checked={form.densidade} onChange={(densidade) => patch({ densidade })} />
            <ToggleRow label="Animações" desc="Transições suaves" checked={form.animacoes} onChange={(animacoes) => patch({ animacoes })} />
            <ToggleRow label="Menu sempre expandido" checked={form.sidebar} onChange={(sidebar) => patch({ sidebar })} />
          </div>
          <div>
            <FieldLabel>Frequência dos avisos</FieldLabel>
            <div className="grid sm:grid-cols-3 gap-3">
              {FREQUENCIES.map((item) => <OptionCard key={item.id} compact selected={form.frequencia === item.id} title={item.title} desc={item.desc} icon={Bell} onClick={() => patch({ frequencia: item.id })} />)}
            </div>
          </div>
          <div className="space-y-2">
            <ToggleRow label="Tarefa atribuída a mim" checked={form.atribuida} onChange={(atribuida) => patch({ atribuida })} />
            <ToggleRow label="Comentários" checked={form.comentarios} onChange={(comentarios) => patch({ comentarios })} />
            <ToggleRow label="Prazo se aproximando" checked={form.prazo} onChange={(prazo) => patch({ prazo })} />
            <ToggleRow label="Tarefa concluída" checked={form.concluida} onChange={(concluida) => patch({ concluida })} />
            <ToggleRow label="Som de notificação" checked={form.som} onChange={(som) => patch({ som })} />
          </div>
        </div>
      )}
      {form && step === 2 && (
        <div className="space-y-6">
          <div>
            <FieldLabel>Idioma</FieldLabel>
            <div className="grid sm:grid-cols-3 gap-3">
              {LANGUAGES.map((item) => <OptionCard key={item.id} compact selected={form.idioma === item.id} title={item.title} icon={Languages} onClick={() => patch({ idioma: item.id })} />)}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Fuso horário</FieldLabel>
              <Input value={form.fuso} onChange={(event) => patch({ fuso: event.target.value })} />
            </div>
            <div>
              <FieldLabel>Formato de data</FieldLabel>
              <select className={selectCls} value={form.formato} onChange={(event) => patch({ formato: event.target.value })}>
                <option value="DD/MM/AAAA">DD/MM/AAAA</option>
                <option value="MM/DD/AAAA">MM/DD/AAAA</option>
                <option value="AAAA-MM-DD">AAAA-MM-DD</option>
              </select>
            </div>
          </div>
          <div>
            <FieldLabel>Quem vê o perfil</FieldLabel>
            <div className="grid sm:grid-cols-3 gap-3">
              {VISIBILITY.map((item) => <OptionCard key={item.id} compact selected={form.visibilidade === item.id} title={item.title} desc={item.desc} icon={Lock} onClick={() => patch({ visibilidade: item.id })} />)}
            </div>
          </div>
          <div className="space-y-2">
            <ToggleRow label="Mostrar quando estou online" checked={form.online} onChange={(online) => patch({ online })} />
            <ToggleRow label="Permitir indexação do perfil" checked={form.indexacao} onChange={(indexacao) => patch({ indexacao })} />
            <ToggleRow label="Compartilhar dados anônimos de uso" checked={form.anonimos} onChange={(anonimos) => patch({ anonimos })} />
          </div>
        </div>
      )}
      {form && step === 3 && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Senha atual</FieldLabel>
              <Input type="password" autoComplete="current-password" value={form.senhaAtual} onChange={(event) => patch({ senhaAtual: event.target.value })} />
            </div>
            <div>
              <FieldLabel>Nova senha</FieldLabel>
              <Input type="password" autoComplete="new-password" value={form.senhaNova} onChange={(event) => patch({ senhaNova: event.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Confirmar nova senha</FieldLabel>
              <Input type="password" autoComplete="new-password" value={form.senhaConfirmacao} onChange={(event) => patch({ senhaConfirmacao: event.target.value })} />
              <p className="mt-2 text-xs text-muted-foreground">Deixe em branco para manter a senha atual. A nova senha precisa ter ao menos 8 caracteres.</p>
              {passwordIssue(form) && <p className="mt-2 text-xs text-destructive">{passwordIssue(form)}</p>}
            </div>
          </div>
          <div>
            <FieldLabel>Segundo fator</FieldLabel>
            <div className="grid sm:grid-cols-2 gap-3">
              {FACTORS.map((item) => <OptionCard key={item.id} compact selected={form.fator === item.id} title={item.title} desc={item.desc} icon={Shield} onClick={() => patch({ fator: item.id })} />)}
            </div>
          </div>
          <div className="max-w-xs">
            <FieldLabel>Preferência de sessão (minutos)</FieldLabel>
            <Input inputMode="numeric" value={form.expira} onChange={(event) => patch({ expira: event.target.value })} />
            <p className="mt-2 text-xs text-muted-foreground">Este valor fica registrado na conta. O acesso continua ativo enquanto o sistema for usado.</p>
            {sessionIssue(form.expira) && <p className="mt-2 text-xs text-destructive">{sessionIssue(form.expira)}</p>}
          </div>
        </div>
      )}
      {form && step === 4 && (
        <ReviewGrid items={[
          ["Nome", form.nome],
          ["E-mail", form.email],
          ["Iniciais", form.iniciais || "—"],
          ["Cargo", form.cargo || "—"],
          ["Departamento", form.departamento || "—"],
          ["Tema", labelOf(THEMES, form.tema)],
          ["Avisos", labelOf(FREQUENCIES, form.frequencia)],
          ["Idioma", labelOf(LANGUAGES, form.idioma)],
          ["Fuso", form.fuso],
          ["Visibilidade", labelOf(VISIBILITY, form.visibilidade)],
          ["Segundo fator", labelOf(FACTORS, form.fator)],
          ["Senha", form.senhaNova ? "Será alterada" : "Mantida"],
        ]} />
      )}
    </WizardShell>
  );
}
