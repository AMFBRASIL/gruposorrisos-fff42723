import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ApiError, apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { applyThemePreference, getThemeMode, type ThemeMode } from "@/lib/store";

export type SettingsSnapshot = {
  canManage: boolean;
  touched: { account: string[]; platform: string[] };
  profile: { nome: string; email: string; cargo: string; departamento: string; bio: string; visibilidade: string };
  appearance: { tema: string; densidade: boolean; animacoes: boolean; sidebar: boolean };
  notifications: { frequencia: string; atribuida: boolean; comentarios: boolean; prazo: boolean; concluida: boolean; som: boolean };
  locale: { idioma: string; fuso: string; formato: string };
  privacy: { perfil: string; online: boolean; indexacao: boolean; anonimos: boolean };
  security: { fator: string; expira: string; sso: boolean; alertas: boolean };
  team: { link: boolean; aprovacao: boolean; dominio: string; papel: string };
  kanban: { wip: string; capa: boolean; avatares: boolean; checklist: boolean; tags: boolean; prazo: boolean; arquivar: boolean };
  automation: { gatilho: string; acao: string };
  activity: { historico: boolean; logs: boolean; visualizou: boolean; dias: string };
  email: {
    metodo: string;
    provedor: string;
    host: string;
    porta: string;
    usuario: string;
    seguranca: string;
    remetente: string;
    nome: string;
    dominio: string;
    regiao: string;
    resumo: boolean;
    executivo: boolean;
    assinatura: boolean;
    status: string;
  };
  integrations: { active: number; items: { servico: string; url: string; configured: boolean }[] };
  ai: { modo: string; assistente: boolean; priorizacao: boolean; resumos: boolean };
  backup: { frequencia: string; dias: string; horario: string };
  api: { ambiente: string; nome: string };
};

export type SettingsDraft = {
  selections: Record<string, string>;
  values: Record<string, string>;
  toggles: Record<string, boolean>;
};

export type SettingsSeed = SettingsDraft & { presets: Record<string, Record<string, string>> };

const MAIL_PROVIDERS = ["resend", "sendgrid", "mailgun", "ses", "postmark", "brevo", "mailjet", "sparkpost", "elastic"];

let settings: SettingsSnapshot | null = null;
const listeners = new Set<() => void>();
let announced = false;

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function authed<T>(path: string, init?: RequestInit) {
  return apiRequest<T>(path, init, getAccessToken());
}

export function useSettings() {
  return useSyncExternalStore(subscribe, () => settings, () => null);
}

export async function loadSettings() {
  try {
    settings = await authed<SettingsSnapshot>("/api/settings");
    emit();
    applySettings(settings);
  } catch (error) {
    if (!announced) {
      announced = true;
      toast.error(error instanceof ApiError ? error.message : "Não foi possível carregar as configurações.");
    }
  }
}

export async function saveSettings(module: string, draft: SettingsDraft) {
  const result = await authed<{ settings: SettingsSnapshot; notice?: string; secret?: string }>("/api/settings", {
    method: "POST",
    body: JSON.stringify({ module, ...draft }),
  });
  settings = result.settings;
  emit();
  applySettings(result.settings);
  return result;
}

export function resetSettings() {
  settings = null;
  announced = false;
  emit();
  if (typeof document === "undefined") return;
  delete document.documentElement.dataset.density;
  delete document.documentElement.dataset.motion;
  document.documentElement.lang = "pt-BR";
  try { localStorage.removeItem("gs-sidebar-lock"); } catch { /* ignore */ }
  window.dispatchEvent(new Event("gs-sidebar"));
}

export function wizardSeed(module: string, current: SettingsSnapshot): SettingsSeed {
  const selections: Record<string, string> = {};
  const values: Record<string, string> = {};
  const toggles: Record<string, boolean> = {};
  const presets: Record<string, Record<string, string>> = {};
  const account = current.touched.account.includes(module);
  const platform = current.touched.platform.includes(module);

  if (module === "perfil") {
    Object.assign(values, current.profile);
    delete values.visibilidade;
    selections.visibilidade = current.profile.visibilidade;
  }
  if (module === "aparencia") {
    const live = getThemeMode();
    selections.tema = account && isTheme(current.appearance.tema) ? current.appearance.tema : live;
    if (account) Object.assign(toggles, { densidade: current.appearance.densidade, animacoes: current.appearance.animacoes, sidebar: current.appearance.sidebar });
  }
  if (module === "notificacoes") {
    selections.frequencia = current.notifications.frequencia;
    Object.assign(toggles, {
      atribuida: current.notifications.atribuida,
      comentarios: current.notifications.comentarios,
      prazo: current.notifications.prazo,
      concluida: current.notifications.concluida,
      som: current.notifications.som,
    });
  }
  if (module === "idioma") {
    selections.idioma = current.locale.idioma;
    values.fuso = current.locale.fuso;
    values.formato = current.locale.formato;
  }
  if (module === "privacidade") {
    selections.perfil = current.privacy.perfil;
    Object.assign(toggles, { online: current.privacy.online, indexacao: current.privacy.indexacao, anonimos: current.privacy.anonimos });
  }
  if (module === "seguranca") {
    selections.fator = account ? current.security.fator : "off";
    values.expira = account ? current.security.expira : current.security.expira || "15";
    if (platform) Object.assign(toggles, { sso: current.security.sso, alertas: current.security.alertas });
  }
  if (module === "equipe") {
    values.dominio = platform ? current.team.dominio : "";
    values.papel = current.team.papel;
    if (platform) Object.assign(toggles, { link: current.team.link, aprovacao: current.team.aprovacao });
  }
  if (module === "kanban") {
    values.wip = current.kanban.wip;
    Object.assign(toggles, {
      capa: current.kanban.capa,
      avatares: current.kanban.avatares,
      checklist: current.kanban.checklist,
      tags: current.kanban.tags,
      prazo: current.kanban.prazo,
      arquivar: current.kanban.arquivar,
    });
  }
  if (module === "automacoes") {
    selections.gatilho = current.automation.gatilho;
    selections.acao = current.automation.acao;
  }
  if (module === "atividades") {
    values.dias = current.activity.dias;
    Object.assign(toggles, { historico: current.activity.historico, logs: current.activity.logs, visualizou: current.activity.visualizou });
  }
  if (module === "email") {
    Object.assign(values, {
      host: current.email.host,
      porta: current.email.porta || "587",
      usuario: current.email.usuario,
      seguranca: current.email.seguranca || "TLS",
      remetente: current.email.remetente,
      nome: current.email.nome || "Grupo Sorrisos",
      dominio: current.email.dominio,
      regiao: current.email.regiao || "us-east-1",
      senha: "",
      apikey: "",
      accesskey: "",
      secretkey: "",
    });
    if (platform) {
      selections.metodo = current.email.metodo;
      selections.provedor = current.email.provedor;
      Object.assign(toggles, { resumo: current.email.resumo, executivo: current.email.executivo, assinatura: current.email.assinatura });
    }
    const api = {
      remetente: current.email.remetente,
      nome: current.email.nome || "Grupo Sorrisos",
      dominio: current.email.dominio,
      regiao: current.email.regiao || "us-east-1",
      apikey: "",
      accesskey: "",
      secretkey: "",
    };
    presets.api = api;
    for (const provider of MAIL_PROVIDERS) presets[provider] = api;
    presets.smtp = {
      host: current.email.host,
      porta: current.email.porta || "587",
      usuario: current.email.usuario,
      seguranca: current.email.seguranca || "TLS",
      remetente: current.email.remetente,
      senha: "",
    };
  }
  if (module === "integracoes") {
    for (const item of current.integrations.items) presets[item.servico] = { url: item.url, token: "", segredo: "" };
    const latest = current.integrations.items[0];
    if (platform && latest) {
      selections.servico = latest.servico;
      values.url = latest.url;
    }
  }
  if (module === "ia") {
    selections.modo = current.ai.modo;
    Object.assign(toggles, { assistente: current.ai.assistente, priorizacao: current.ai.priorizacao, resumos: current.ai.resumos });
  }
  if (module === "api" && platform) {
    selections.ambiente = current.api.ambiente;
    values.nome = current.api.nome;
  }
  if (module === "backup") {
    selections.frequencia = current.backup.frequencia;
    values.dias = current.backup.dias;
    values.horario = current.backup.horario;
  }
  return { selections, values, toggles, presets };
}

function isTheme(value: string): value is ThemeMode {
  return value === "claro" || value === "escuro" || value === "auto";
}

function applySettings(current: SettingsSnapshot) {
  if (typeof document === "undefined") return;
  if (current.touched.account.includes("aparencia")) {
    if (isTheme(current.appearance.tema)) applyThemePreference(current.appearance.tema);
    if (current.appearance.densidade) document.documentElement.dataset.density = "compact";
    else delete document.documentElement.dataset.density;
    if (current.appearance.animacoes) delete document.documentElement.dataset.motion;
    else document.documentElement.dataset.motion = "off";
    try {
      if (current.appearance.sidebar) {
        localStorage.setItem("gs-sidebar-lock", "expanded");
        localStorage.setItem("sidebar-collapsed", "0");
      } else localStorage.removeItem("gs-sidebar-lock");
    } catch { /* ignore */ }
    window.dispatchEvent(new Event("gs-sidebar"));
  }
  if (current.touched.account.includes("idioma")) {
    document.documentElement.lang = current.locale.idioma === "en" ? "en" : current.locale.idioma === "es" ? "es" : "pt-BR";
  }
}
