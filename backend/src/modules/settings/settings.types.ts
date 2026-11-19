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

export type MailSecretSlot = { password?: string; apiKey?: string; secretKey?: string };

export type MailBundle = {
  config: {
    method: "smtp" | "api";
    provider: string;
    from: string;
    fromName: string;
    signature: boolean;
    status: "ausente" | "pendente" | "ativo";
    smtp: { host: string; port: number; user: string; password: string; security: string } | null;
    apiKey: string;
    secretKey: string;
    domain: string;
    region: string;
  };
  secrets: Record<string, MailSecretSlot>;
  public: { host: string; port: string; user: string; security: string; from: string; fromName: string; domain: string; region: string };
  weekly: boolean;
  executive: boolean;
  signature: boolean;
};
