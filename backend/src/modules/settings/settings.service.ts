import { AppError } from "../../shared/errors.js";
import type { AuthUser } from "../auth/auth.types.js";
import { isMailProvider, smtpSecurity } from "../mail/mail.rules.js";
import type { MailService } from "../mail/mail.service.js";
import { MailDeliveryError, type ActiveMail } from "../mail/mail.types.js";
import { blankSecret, clampInt, domainAllowed, isAccountModule, isSettingsModule, normalizeDomain, oneOf, parseClock } from "./settings.rules.js";
import type { SettingsRepository } from "./settings.repository.js";
import type { MailBundle, SettingsDraft } from "./settings.types.js";

const THEMES = ["claro", "escuro", "auto"] as const;
const FREQUENCIES = ["instantaneo", "diario", "semanal"] as const;
const VISIBILITY = ["equipe", "gestores", "privado"] as const;
const LANGUAGES = ["ptbr", "en", "es"] as const;
const FACTORS = ["app", "sms", "email2", "off"] as const;
const TRIGGERS = ["concluido", "prazo", "comentario", "agendado"] as const;
const ACTIONS = ["notificar", "urgente", "email", "resumo"] as const;
const AI_MODES = ["conservador", "equilibrado", "proativo"] as const;
const BACKUP = ["diario", "semanal", "mensal"] as const;
const SERVICES = ["slack", "gcal", "github", "teams", "whatsapp", "webhook"] as const;
const ENVIRONMENTS = ["producao", "dev"] as const;

function checked(value: boolean | undefined, fallback: boolean) {
  return value ?? fallback;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export class SettingsService {
  constructor(
    private readonly repository: SettingsRepository,
    private readonly mail: MailService,
  ) {}

  snapshot(user: AuthUser) {
    return this.repository.snapshot(user.id, user.permissions.includes("usuarios.gerenciar"));
  }

  async save(user: AuthUser, module: string, draft: SettingsDraft, ip: string | null) {
    if (!isSettingsModule(module)) throw new AppError(400, "VALIDATION", "Módulo de configuração inválido.");
    if (!isAccountModule(module)) this.assertManager(user);
    const result = await this.persist(user, module, draft, ip);
    const settings = await this.repository.snapshot(user.id, user.permissions.includes("usuarios.gerenciar"));
    return { settings, notice: result.notice, secret: result.secret };
  }

  async runAutomation(trigger: string, message: { to: string; subject: string; text: string }) {
    const rule = await this.repository.automationFor(trigger);
    if (!rule) return { ran: false };
    if (rule.acao === "email") {
      const delivered = await this.mail.send(message);
      return { ran: delivered.delivered, action: rule.acao };
    }
    return { ran: true, action: rule.acao };
  }

  private async persist(user: AuthUser, module: string, draft: SettingsDraft, ip: string | null): Promise<{ notice?: string; secret?: string }> {
    try {
      if (module === "perfil") return await this.saveProfile(user, draft, ip);
      if (module === "aparencia") return await this.saveAppearance(user, draft, ip);
      if (module === "notificacoes") return await this.saveNotifications(user, draft, ip);
      if (module === "idioma") return await this.saveLocale(user, draft, ip);
      if (module === "privacidade") return await this.savePrivacy(user, draft, ip);
      if (module === "seguranca") return await this.saveSecurity(user, draft, ip);
      if (module === "equipe") return await this.saveTeam(user, draft, ip);
      if (module === "kanban") return await this.saveKanban(user, draft, ip);
      if (module === "automacoes") return await this.saveAutomation(user, draft, ip);
      if (module === "atividades") return await this.saveActivity(user, draft, ip);
      if (module === "ia") return await this.saveAi(user, draft, ip);
      if (module === "backup") return await this.saveBackup(user, draft, ip);
      if (module === "integracoes") return await this.saveIntegration(user, draft, ip);
      if (module === "api") return await this.saveToken(user, draft, ip);
      return await this.saveEmail(user, draft, ip);
    } catch (error) {
      if (error instanceof AppError) throw error;
      const code = error instanceof Error ? error.message : "";
      if (code === "EMAIL_IN_USE") throw new AppError(409, "EMAIL_IN_USE", "Já existe um usuário com este e-mail.");
      if (code === "NOT_FOUND") throw new AppError(404, "NOT_FOUND", "Usuário não encontrado.");
      if (code === "DOMAIN") throw new AppError(400, "VALIDATION", "Informe um domínio válido, como @gruposorrisos.com.br.");
      if (code === "CLOCK") throw new AppError(400, "VALIDATION", "Informe o horário no formato HH:MM.");
      if (code === "MISSING_SECRET") throw new AppError(400, "VALIDATION", "Informe a credencial da integração.");
      throw error;
    }
  }

  private async saveProfile(user: AuthUser, draft: SettingsDraft, ip: string | null) {
    const nome = draft.values.nome?.trim() ?? "";
    const email = draft.values.email?.trim() ?? "";
    if (nome.length < 2) throw new AppError(400, "VALIDATION", "Informe o nome completo.");
    if (!isEmail(email)) throw new AppError(400, "VALIDATION", "Informe um e-mail válido.");
    await this.repository.saveProfile(user.id, {
      nome,
      email,
      cargo: draft.values.cargo ?? "",
      departamento: draft.values.departamento ?? "",
      bio: draft.values.bio ?? "",
      visibilidade: oneOf(draft.selections.visibilidade, VISIBILITY, "equipe"),
      iniciais: draft.values.iniciais,
      cor: draft.values.cor,
    }, ip);
    return {};
  }

  private async saveAppearance(user: AuthUser, draft: SettingsDraft, ip: string | null) {
    await this.repository.saveAppearance(user.id, {
      tema: oneOf(draft.selections.tema, THEMES, "escuro"),
      densidade: checked(draft.toggles.densidade, false),
      animacoes: checked(draft.toggles.animacoes, true),
      sidebar: checked(draft.toggles.sidebar, true),
    }, ip);
    return {};
  }

  private async saveNotifications(user: AuthUser, draft: SettingsDraft, ip: string | null) {
    await this.repository.saveNotifications(user.id, {
      frequencia: oneOf(draft.selections.frequencia, FREQUENCIES, "instantaneo"),
      atribuida: checked(draft.toggles.atribuida, true),
      comentarios: checked(draft.toggles.comentarios, true),
      prazo: checked(draft.toggles.prazo, true),
      concluida: checked(draft.toggles.concluida, false),
      som: checked(draft.toggles.som, false),
    }, ip);
    return {};
  }

  private async saveLocale(user: AuthUser, draft: SettingsDraft, ip: string | null) {
    const fuso = (draft.values.fuso ?? "").trim();
    const formato = (draft.values.formato ?? "").trim();
    if (!/^[A-Za-z0-9_/+-]{1,64}$/.test(fuso)) throw new AppError(400, "VALIDATION", "Informe um fuso horário válido.");
    if (!formato || formato.length > 20) throw new AppError(400, "VALIDATION", "Informe o formato de data.");
    await this.repository.saveLocale(user.id, {
      idioma: oneOf(draft.selections.idioma, LANGUAGES, "ptbr"),
      fuso,
      formato,
    }, ip);
    return {};
  }

  private async savePrivacy(user: AuthUser, draft: SettingsDraft, ip: string | null) {
    await this.repository.savePrivacy(user.id, {
      perfil: oneOf(draft.selections.perfil, VISIBILITY, "equipe"),
      online: checked(draft.toggles.online, true),
      indexacao: checked(draft.toggles.indexacao, false),
      anonimos: checked(draft.toggles.anonimos, true),
    }, ip);
    return {};
  }

  private async saveSecurity(user: AuthUser, draft: SettingsDraft, ip: string | null) {
    const expira = clampInt(draft.values.expira || "15", 5, 1440);
    if (!expira) throw new AppError(400, "VALIDATION", "A sessão precisa expirar entre 5 e 1440 minutos.");
    const fator = oneOf(draft.selections.fator, FACTORS, "off");
    const canManage = user.permissions.includes("usuarios.gerenciar");
    const saved = await this.repository.saveSecurity(user.id, {
      fator,
      expira,
      ...(canManage ? { sso: checked(draft.toggles.sso, false), alertas: checked(draft.toggles.alertas, true) } : {}),
    }, ip);
    if (saved.totp) {
      return { secret: saved.totp, notice: "Cadastre esta chave no aplicativo autenticador. O login por senha continua ativo." };
    }
    if (fator === "sms") return { notice: "A preferência de SMS foi salva. O login por senha continua ativo." };
    if (fator === "email2") return { notice: "A preferência de código por e-mail foi salva. O login por senha continua ativo." };
    if (!canManage) return { notice: "A segurança da sua conta foi salva." };
    return {};
  }

  private async saveTeam(user: AuthUser, draft: SettingsDraft, ip: string | null) {
    const dominio = normalizeDomain(draft.values.dominio ?? "");
    if (dominio && !domainAllowed(`pessoa${dominio}`, dominio)) throw new AppError(400, "VALIDATION", "Informe um domínio válido.");
    await this.repository.saveTeam(user.id, {
      link: checked(draft.toggles.link, true),
      aprovacao: checked(draft.toggles.aprovacao, true),
      dominio,
      papel: (draft.values.papel ?? "").trim() || "Colaborador(a)",
    }, ip);
    return { notice: dominio ? `Novos usuários precisam usar o domínio ${dominio}.` : "Regras da equipe salvas." };
  }

  private async saveKanban(user: AuthUser, draft: SettingsDraft, ip: string | null) {
    const wip = clampInt(draft.values.wip || "8", 1, 50);
    if (!wip) throw new AppError(400, "VALIDATION", "O limite WIP precisa ficar entre 1 e 50.");
    await this.repository.saveKanban(user.id, {
      wip,
      capa: checked(draft.toggles.capa, true),
      avatares: checked(draft.toggles.avatares, true),
      checklist: checked(draft.toggles.checklist, true),
      tags: checked(draft.toggles.tags, true),
      prazo: checked(draft.toggles.prazo, true),
      arquivar: checked(draft.toggles.arquivar, false),
    }, ip);
    return {};
  }

  private async saveAutomation(user: AuthUser, draft: SettingsDraft, ip: string | null) {
    await this.repository.saveAutomation(user.id, {
      gatilho: oneOf(draft.selections.gatilho, TRIGGERS, "concluido"),
      acao: oneOf(draft.selections.acao, ACTIONS, "notificar"),
    }, ip);
    return { notice: "Regra registrada." };
  }

  private async saveActivity(user: AuthUser, draft: SettingsDraft, ip: string | null) {
    const dias = clampInt(draft.values.dias || "90", 1, 3650);
    if (!dias) throw new AppError(400, "VALIDATION", "A retenção precisa ficar entre 1 e 3650 dias.");
    await this.repository.saveActivity(user.id, {
      historico: checked(draft.toggles.historico, true),
      logs: checked(draft.toggles.logs, true),
      visualizou: checked(draft.toggles.visualizou, false),
      dias,
    }, ip);
    return {};
  }

  private async saveAi(user: AuthUser, draft: SettingsDraft, ip: string | null) {
    await this.repository.saveAi(user.id, {
      modo: oneOf(draft.selections.modo, AI_MODES, "equilibrado"),
      assistente: checked(draft.toggles.assistente, true),
      priorizacao: checked(draft.toggles.priorizacao, true),
      resumos: checked(draft.toggles.resumos, false),
    }, ip);
    return {};
  }

  private async saveBackup(user: AuthUser, draft: SettingsDraft, ip: string | null) {
    const dias = clampInt(draft.values.dias || "30", 1, 3650);
    if (!dias) throw new AppError(400, "VALIDATION", "A retenção do backup precisa ficar entre 1 e 3650 dias.");
    await this.repository.saveBackup(user.id, {
      frequencia: oneOf(draft.selections.frequencia, BACKUP, "diario"),
      dias,
      horario: parseClock(draft.values.horario || "03:00"),
    }, ip);
    return { notice: "Agenda de backup registrada." };
  }

  private async saveIntegration(user: AuthUser, draft: SettingsDraft, ip: string | null) {
    const service = oneOf(draft.selections.servico, SERVICES, "slack");
    const url = service === "webhook" ? (draft.values.url ?? "").trim() : "";
    const typed = service === "webhook" ? draft.values.segredo : draft.values.token;
    if (service === "webhook" && !/^https?:\/\/\S+$/i.test(url)) throw new AppError(400, "VALIDATION", "Informe a URL do endpoint.");
    const current = await this.repository.snapshot(user.id, true);
    const existing = current.integrations.items.find((item) => item.servico === service);
    const secret = blankSecret(typed) ? null : typed!.trim();
    if (!secret && !existing?.configured) throw new AppError(400, "VALIDATION", "Informe a credencial da integração.");
    await this.repository.saveIntegration(user.id, { service, url, secret }, ip);
    return { notice: "Integração salva." };
  }

  private async saveToken(user: AuthUser, draft: SettingsDraft, ip: string | null) {
    const nome = (draft.values.nome ?? "").trim();
    if (nome.length < 2) throw new AppError(400, "VALIDATION", "Dê um nome ao token.");
    const secret = await this.repository.issueToken(user.id, {
      nome,
      ambiente: oneOf(draft.selections.ambiente, ENVIRONMENTS, "producao"),
    }, ip);
    return { secret, notice: "Token criado. Copie agora; ele não será mostrado de novo." };
  }

  private async saveEmail(user: AuthUser, draft: SettingsDraft, ip: string | null) {
    const bundle = await this.repository.readMailBundle();
    const method = draft.selections.metodo === "smtp" ? "smtp" : "api";
    const provider = isMailProvider(draft.selections.provedor ?? "") ? draft.selections.provedor! : bundle.config.provider || "resend";
    const weekly = checked(draft.toggles.resumo, bundle.weekly);
    const executive = checked(draft.toggles.executivo, bundle.executive);
    const signature = checked(draft.toggles.assinatura, bundle.signature);
    const next = this.mergeMail(bundle, draft, method, provider, signature);
    let status = next.status;
    let error: string | null = null;
    let notice = "Preferências de envio salvas.";
    if (next.ready && next.changed) {
      const confirmed = await this.confirm(next.config, user.email);
      status = confirmed.status;
      error = confirmed.error;
      notice = confirmed.notice;
    } else if (!next.ready) {
      status = "ausente";
      error = null;
      notice = "Preferências salvas. O envio ainda não está ativo.";
    }
    await this.repository.writeMail(user.id, {
      method,
      provider,
      public: next.public,
      secrets: next.secrets,
      weekly,
      executive,
      signature,
      status,
      error,
    }, ip);
    return { notice };
  }

  private mergeMail(bundle: MailBundle, draft: SettingsDraft, method: "smtp" | "api", provider: string, signature: boolean) {
    const values = draft.values;
    const from = (values.remetente ?? bundle.public.from).trim().toLowerCase();
    const fromName = values.nome !== undefined ? (values.nome.trim() || "Grupo Sorrisos") : bundle.public.fromName;
    const host = values.host !== undefined ? values.host.trim() : bundle.public.host;
    const portText = values.porta !== undefined ? values.porta.trim() : bundle.public.port;
    const userName = values.usuario !== undefined ? values.usuario.trim() : bundle.public.user;
    const security = values.seguranca !== undefined ? (values.seguranca.trim() || "TLS") : bundle.public.security;
    const domain = values.dominio !== undefined ? values.dominio.trim() : bundle.public.domain;
    const region = values.regiao !== undefined ? (values.regiao.trim() || "us-east-1") : bundle.public.region;
    const secrets = { ...bundle.secrets };
    const slot = { ...(secrets[method === "smtp" ? "smtp" : provider] ?? {}) };
    if (method === "smtp" && !blankSecret(values.senha)) slot.password = values.senha!.trim();
    if (method === "api" && provider === "ses") {
      if (!blankSecret(values.accesskey)) slot.apiKey = values.accesskey!.trim();
      if (!blankSecret(values.secretkey)) slot.secretKey = values.secretkey!.trim();
    } else if (method === "api" && !blankSecret(values.apikey)) {
      slot.apiKey = values.apikey!.trim();
    }
    secrets[method === "smtp" ? "smtp" : provider] = slot;
    const port = clampInt(portText || "587", 1, 65535);
    const config: ActiveMail = {
      method,
      provider,
      from,
      fromName,
      signature,
      status: "pendente",
      smtp: method === "smtp" && port ? { host, port, user: userName, password: slot.password ?? "", security: smtpSecurity(security) } : null,
      apiKey: slot.apiKey ?? "",
      secretKey: slot.secretKey ?? "",
      domain,
      region,
    };
    const ready = method === "smtp"
      ? Boolean(host && port && slot.password && isEmail(from))
      : Boolean(slot.apiKey && isEmail(from) && (provider !== "ses" || slot.secretKey) && (provider !== "mailgun" || domain) && (provider !== "mailjet" || slot.apiKey!.includes(":")) && (provider !== "ses" || /^[a-z]{2}-[a-z]+-\d+$/.test(region)));
    if (method === "smtp" && (host || userName || slot.password || from) && !ready) {
      if (!host) throw new AppError(400, "VALIDATION", "Informe o host SMTP.");
      if (!port) throw new AppError(400, "VALIDATION", "Informe uma porta SMTP válida.");
      if (!slot.password) throw new AppError(400, "VALIDATION", "Informe a senha SMTP.");
      throw new AppError(400, "VALIDATION", "Informe o e-mail remetente.");
    }
    if (method === "api" && (slot.apiKey || slot.secretKey || from) && !ready) {
      if (!slot.apiKey) throw new AppError(400, "VALIDATION", provider === "ses" ? "Informe a access key da AWS." : "Informe a chave de API.");
      if (provider === "ses" && !slot.secretKey) throw new AppError(400, "VALIDATION", "Informe a secret key da AWS.");
      if (provider === "mailgun" && !domain) throw new AppError(400, "VALIDATION", "Informe o domínio de envio do Mailgun.");
      if (provider === "mailjet" && !slot.apiKey!.includes(":")) throw new AppError(400, "VALIDATION", "A chave do Mailjet precisa estar no formato chave:segredo.");
      if (provider === "ses" && !/^[a-z]{2}-[a-z]+-\d+$/.test(region)) throw new AppError(400, "VALIDATION", "Informe a região AWS.");
      throw new AppError(400, "VALIDATION", "Informe o e-mail remetente.");
    }
    const previous = bundle.config;
    const changed = method === "smtp"
      ? !blankSecret(values.senha) || previous.method !== "smtp" || previous.smtp?.host !== host || previous.smtp?.port !== port || previous.smtp?.user !== userName || previous.from !== from || previous.smtp?.security !== smtpSecurity(security)
      : !blankSecret(values.apikey) || !blankSecret(values.accesskey) || !blankSecret(values.secretkey) || previous.method !== "api" || previous.provider !== provider || previous.from !== from || previous.domain !== domain || previous.region !== region || previous.apiKey !== (slot.apiKey ?? "");
    return {
      ready,
      changed,
      config,
      secrets,
      status: previous.status,
      public: { host, port: String(port ?? bundle.public.port), user: userName, security, from, fromName, domain, region },
    };
  }

  private async confirm(config: ActiveMail, to: string) {
    try {
      await this.mail.deliver(config, {
        to,
        subject: "Grupo Sorrisos — confirmação de envio",
        text: "Este e-mail confirma que o serviço de envio da plataforma está pronto para os demais módulos.",
      });
      return { status: "ativo" as const, error: null, notice: "Enviamos um e-mail de confirmação para o seu endereço." };
    } catch (error) {
      const message = error instanceof MailDeliveryError ? error.message : "Não foi possível confirmar o envio.";
      return { status: "pendente" as const, error: message.slice(0, 300), notice: `Configuração salva. ${message}` };
    }
  }

  private assertManager(user: AuthUser) {
    if (!user.permissions.includes("usuarios.gerenciar")) {
      throw new AppError(403, "FORBIDDEN", "Sem permissão para alterar as configurações da organização.");
    }
  }
}
