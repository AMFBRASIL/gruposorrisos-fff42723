import { randomBytes } from "node:crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "../../database/pool.js";
import { transaction } from "../../database/pool.js";
import { openSecret, sealSecret } from "../../shared/secret-box.js";
import { sha256, smtpSecurity } from "../mail/mail.rules.js";
import type { ActiveMail } from "../mail/mail.types.js";
import { initialsOf } from "./settings.rules.js";
import type { MailBundle, MailSecretSlot, SettingsSnapshot } from "./settings.types.js";

type SqlRow = RowDataPacket & Record<string, unknown>;

type MailPublic = {
  host?: string;
  port?: string;
  user?: string;
  security?: string;
  from?: string;
  fromName?: string;
  domain?: string;
  region?: string;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

function flag(value: unknown, fallback = false) {
  if (value == null) return fallback;
  return Number(value) === 1;
}

function jsonList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string" && value) {
    try {
      return jsonList(JSON.parse(value) as unknown);
    } catch {
      return [];
    }
  }
  return [];
}

function addTouched(current: unknown, module: string) {
  const list = jsonList(current);
  if (!list.includes(module)) list.push(module);
  return list;
}

function readJson<T>(value: unknown): T | null {
  if (!value) return null;
  if (typeof value === "object") return value as T;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function totpSecret() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = randomBytes(20);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let index = 0; index + 5 <= bits.length; index += 5) out += alphabet[Number.parseInt(bits.slice(index, index + 5), 2)];
  return out;
}

export class SettingsRepository {
  constructor(
    private readonly pool: Pool,
    private readonly secret: string,
  ) {}

  async snapshot(userId: string, canManage: boolean): Promise<SettingsSnapshot> {
    const [users] = await this.pool.query<SqlRow[]>(
      `SELECT u.name, u.email, u.job_title, d.name AS department_name,
              p.theme, p.compact_density, p.animations, p.sidebar_expanded,
              p.notification_frequency, p.notify_assigned, p.notify_comments, p.notify_deadline,
              p.notify_completed, p.notify_sound, p.language, p.timezone, p.date_format,
              p.profile_visibility, p.show_online, p.allow_indexing, p.share_anonymous,
              p.bio, p.department_label, p.two_factor, p.session_minutes, p.touched
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN user_preferences p ON p.user_id = u.id
       WHERE u.id = ? AND u.deleted_at IS NULL
       LIMIT 1`,
      [userId],
    );
    const user = users[0];
    if (!user) throw new Error("NOT_FOUND");

    const platform = await this.platformRow();
    const mail = readJson<MailPublic>(platform.mail_public) ?? {};
    const [integrations] = await this.pool.query<SqlRow[]>(
      `SELECT service, public_config, (secret_blob IS NOT NULL AND secret_blob <> '') AS configured, active
       FROM integrations ORDER BY updated_at DESC, id DESC`,
    );
    const [rules] = await this.pool.query<SqlRow[]>(
      `SELECT trigger_code, action_code FROM automation_rules WHERE active = 1 ORDER BY id DESC LIMIT 1`,
    );
    const [tokens] = await this.pool.query<SqlRow[]>(
      `SELECT name, environment FROM api_tokens WHERE revoked_at IS NULL ORDER BY id DESC LIMIT 1`,
    );
    const rule = rules[0];
    const token = tokens[0];
    const items = integrations.map((row) => ({
      servico: text(row.service),
      url: readJson<{ url?: string }>(row.public_config)?.url ?? "",
      configured: flag(row.configured),
      active: flag(row.active),
    }));

    const snapshot: SettingsSnapshot = {
      canManage,
      touched: { account: jsonList(user.touched), platform: jsonList(platform.touched) },
      profile: {
        nome: text(user.name),
        email: text(user.email),
        cargo: text(user.job_title),
        departamento: text(user.department_label) || text(user.department_name),
        bio: text(user.bio),
        visibilidade: text(user.profile_visibility) || "equipe",
      },
      appearance: {
        tema: text(user.theme) || "escuro",
        densidade: flag(user.compact_density),
        animacoes: flag(user.animations, true),
        sidebar: flag(user.sidebar_expanded, true),
      },
      notifications: {
        frequencia: text(user.notification_frequency) || "instantaneo",
        atribuida: flag(user.notify_assigned, true),
        comentarios: flag(user.notify_comments, true),
        prazo: flag(user.notify_deadline, true),
        concluida: flag(user.notify_completed),
        som: flag(user.notify_sound),
      },
      locale: {
        idioma: text(user.language) || "ptbr",
        fuso: text(user.timezone) || "America/Sao_Paulo",
        formato: text(user.date_format) || "DD/MM/AAAA",
      },
      privacy: {
        perfil: text(user.profile_visibility) || "equipe",
        online: flag(user.show_online, true),
        indexacao: flag(user.allow_indexing),
        anonimos: flag(user.share_anonymous, true),
      },
      security: {
        fator: text(user.two_factor) || "off",
        expira: String(user.session_minutes ?? 15),
        sso: flag(platform.sso_enabled),
        alertas: flag(platform.suspicious_login_alerts, true),
      },
      team: {
        link: flag(platform.invite_by_link, true),
        aprovacao: flag(platform.require_approval, true),
        dominio: text(platform.allowed_domain),
        papel: text(platform.default_role) || "Colaborador(a)",
      },
      kanban: {
        wip: String(platform.kanban_wip ?? 8),
        capa: flag(platform.show_cover, true),
        avatares: flag(platform.show_avatars, true),
        checklist: flag(platform.show_checklist, true),
        tags: flag(platform.show_tags, true),
        prazo: flag(platform.show_due, true),
        arquivar: flag(platform.auto_archive),
      },
      automation: {
        gatilho: text(rule?.trigger_code) || "concluido",
        acao: text(rule?.action_code) || "notificar",
      },
      activity: {
        historico: flag(platform.log_task_history, true),
        logs: flag(platform.log_access, true),
        visualizou: flag(platform.show_viewers),
        dias: String(platform.history_retention_days ?? 90),
      },
      email: {
        metodo: text(platform.mail_method) === "smtp" ? "smtp" : "api",
        provedor: text(platform.mail_provider) || "resend",
        host: text(mail.host),
        porta: text(mail.port) || "587",
        usuario: text(mail.user),
        seguranca: text(mail.security) || "TLS",
        remetente: text(mail.from),
        nome: text(mail.fromName) || "Grupo Sorrisos",
        dominio: text(mail.domain),
        regiao: text(mail.region) || "us-east-1",
        resumo: flag(platform.mail_weekly, true),
        executivo: flag(platform.mail_executive, true),
        assinatura: flag(platform.mail_signature, true),
        status: text(platform.mail_status) || "ausente",
      },
      integrations: { active: items.filter((item) => item.active).length, items },
      ai: {
        modo: text(platform.ai_mode) || "equilibrado",
        assistente: flag(platform.ai_assistant, true),
        priorizacao: flag(platform.ai_priority, true),
        resumos: flag(platform.ai_summaries),
      },
      backup: {
        frequencia: text(platform.backup_frequency) || "diario",
        dias: String(platform.backup_retention_days ?? 30),
        horario: text(platform.backup_time) || "03:00",
      },
      api: {
        ambiente: text(token?.environment) || "producao",
        nome: text(token?.name),
      },
    };

    if (!canManage) {
      snapshot.email = { ...snapshot.email, host: "", usuario: "", remetente: "", dominio: "", status: "ausente" };
      snapshot.team = { ...snapshot.team, dominio: "" };
      snapshot.integrations = { active: snapshot.integrations.active, items: [] };
      snapshot.api = { ambiente: "producao", nome: "" };
      snapshot.security = { ...snapshot.security, sso: false, alertas: true };
      snapshot.touched = { account: snapshot.touched.account, platform: [] };
    }
    return snapshot;
  }

  async saveProfile(userId: string, input: { nome: string; email: string; cargo: string; departamento: string; bio: string; visibilidade: string; iniciais?: string; cor?: string }, ip: string | null) {
    const email = input.email.trim().toLowerCase();
    const [duplicates] = await this.pool.query<SqlRow[]>(
      `SELECT id FROM users WHERE email = ? AND deleted_at IS NULL AND id <> ? LIMIT 1`,
      [email, userId],
    );
    if (duplicates.length) throw new Error("EMAIL_IN_USE");
    const label = input.departamento.trim().slice(0, 80);
    const departmentId = label ? await this.departmentId(label) : null;
    const initials = input.iniciais?.trim() ? input.iniciais.trim().slice(0, 4).toUpperCase() : initialsOf(input.nome);
    await transaction(this.pool, async (connection) => {
      const fields = ["name = ?", "email = ?", "job_title = ?", "initials = ?"];
      const params: Array<string | null> = [input.nome.trim().slice(0, 150), email, input.cargo.trim().slice(0, 120) || null, initials];
      if (input.cor?.trim()) {
        fields.push("color = ?");
        params.push(input.cor.trim().slice(0, 40));
      }
      if (!label || departmentId) {
        fields.push("department_id = ?");
        params.push(departmentId);
      }
      params.push(userId);
      const [updated] = await connection.query<ResultSetHeader>(
        `UPDATE users SET ${fields.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
        params,
      );
      if (!updated.affectedRows) throw new Error("NOT_FOUND");
    });
    await this.touchUser(userId, "perfil", {
      bio: input.bio.trim().slice(0, 500) || null,
      department_label: label || null,
      profile_visibility: input.visibilidade,
    }, ip, "Atualizou o perfil");
  }

  async saveAppearance(userId: string, input: { tema: string; densidade: boolean; animacoes: boolean; sidebar: boolean }, ip: string | null) {
    await this.touchUser(userId, "aparencia", {
      theme: input.tema,
      compact_density: input.densidade ? 1 : 0,
      animations: input.animacoes ? 1 : 0,
      sidebar_expanded: input.sidebar ? 1 : 0,
    }, ip, "Atualizou a aparência");
  }

  async saveNotifications(userId: string, input: { frequencia: string; atribuida: boolean; comentarios: boolean; prazo: boolean; concluida: boolean; som: boolean }, ip: string | null) {
    await this.touchUser(userId, "notificacoes", {
      notification_frequency: input.frequencia,
      notify_assigned: input.atribuida ? 1 : 0,
      notify_comments: input.comentarios ? 1 : 0,
      notify_deadline: input.prazo ? 1 : 0,
      notify_completed: input.concluida ? 1 : 0,
      notify_sound: input.som ? 1 : 0,
    }, ip, "Atualizou as notificações");
  }

  async saveLocale(userId: string, input: { idioma: string; fuso: string; formato: string }, ip: string | null) {
    await this.touchUser(userId, "idioma", {
      language: input.idioma,
      timezone: input.fuso.slice(0, 64),
      date_format: input.formato.slice(0, 20),
    }, ip, "Atualizou idioma e região");
  }

  async savePrivacy(userId: string, input: { perfil: string; online: boolean; indexacao: boolean; anonimos: boolean }, ip: string | null) {
    await this.touchUser(userId, "privacidade", {
      profile_visibility: input.perfil,
      show_online: input.online ? 1 : 0,
      allow_indexing: input.indexacao ? 1 : 0,
      share_anonymous: input.anonimos ? 1 : 0,
    }, ip, "Atualizou a privacidade");
  }

  async saveSecurity(userId: string, input: { fator: string; expira: number; sso?: boolean; alertas?: boolean }, ip: string | null) {
    await this.pool.query("INSERT IGNORE INTO user_preferences (user_id) VALUES (?)", [userId]);
    const [rows] = await this.pool.query<SqlRow[]>(`SELECT totp_secret FROM user_preferences WHERE user_id = ?`, [userId]);
    let created: string | undefined;
    let stored = text(rows[0]?.totp_secret);
    if (input.fator === "app" && !stored) {
      created = totpSecret();
      stored = sealSecret(this.secret, created);
    }
    await this.touchUser(userId, "seguranca", {
      two_factor: input.fator,
      session_minutes: input.expira,
      totp_secret: stored || null,
    }, ip, "Atualizou a segurança da conta");
    if (input.sso !== undefined && input.alertas !== undefined) {
      await this.touchPlatform("seguranca", {
        sso_enabled: input.sso ? 1 : 0,
        suspicious_login_alerts: input.alertas ? 1 : 0,
      }, userId, ip, "Atualizou a política de segurança");
    }
    return { totp: created };
  }

  async saveTeam(actorId: string, input: { link: boolean; aprovacao: boolean; dominio: string; papel: string }, ip: string | null) {
    await this.touchPlatform("equipe", {
      invite_by_link: input.link ? 1 : 0,
      require_approval: input.aprovacao ? 1 : 0,
      allowed_domain: input.dominio,
      default_role: input.papel.slice(0, 80) || "Colaborador(a)",
    }, actorId, ip, "Atualizou as regras da equipe");
  }

  async saveKanban(actorId: string, input: { wip: number; capa: boolean; avatares: boolean; checklist: boolean; tags: boolean; prazo: boolean; arquivar: boolean }, ip: string | null) {
    await this.touchPlatform("kanban", {
      kanban_wip: input.wip,
      show_cover: input.capa ? 1 : 0,
      show_avatars: input.avatares ? 1 : 0,
      show_checklist: input.checklist ? 1 : 0,
      show_tags: input.tags ? 1 : 0,
      show_due: input.prazo ? 1 : 0,
      auto_archive: input.arquivar ? 1 : 0,
    }, actorId, ip, "Atualizou o kanban");
  }

  async saveAutomation(actorId: string, input: { gatilho: string; acao: string }, ip: string | null) {
    await this.pool.query(
      `INSERT INTO automation_rules (trigger_code, action_code, active, created_by) VALUES (?, ?, 1, ?)`,
      [input.gatilho, input.acao, actorId],
    );
    await this.touchPlatform("automacoes", {}, actorId, ip, "Registrou uma automação");
  }

  async saveActivity(actorId: string, input: { historico: boolean; logs: boolean; visualizou: boolean; dias: number }, ip: string | null) {
    await this.touchPlatform("atividades", {
      log_task_history: input.historico ? 1 : 0,
      log_access: input.logs ? 1 : 0,
      show_viewers: input.visualizou ? 1 : 0,
      history_retention_days: input.dias,
    }, actorId, ip, "Atualizou o histórico de atividades");
  }

  async saveAi(actorId: string, input: { modo: string; assistente: boolean; priorizacao: boolean; resumos: boolean }, ip: string | null) {
    await this.touchPlatform("ia", {
      ai_mode: input.modo,
      ai_assistant: input.assistente ? 1 : 0,
      ai_priority: input.priorizacao ? 1 : 0,
      ai_summaries: input.resumos ? 1 : 0,
    }, actorId, ip, "Atualizou a IA");
  }

  async saveBackup(actorId: string, input: { frequencia: string; dias: number; horario: string }, ip: string | null) {
    await this.touchPlatform("backup", {
      backup_frequency: input.frequencia,
      backup_retention_days: input.dias,
      backup_time: input.horario,
    }, actorId, ip, "Atualizou a agenda de backup");
    await this.pool.query(
      `INSERT INTO backup_jobs (frequency, retention_days, run_time, status, requested_by) VALUES (?, ?, ?, 'agendado', ?)`,
      [input.frequencia, input.dias, input.horario, actorId],
    );
  }

  async saveIntegration(actorId: string, input: { service: string; url: string; secret: string | null }, ip: string | null) {
    const [rows] = await this.pool.query<SqlRow[]>(`SELECT secret_blob FROM integrations WHERE service = ? LIMIT 1`, [input.service]);
    const current = text(rows[0]?.secret_blob);
    const secret = input.secret ? sealSecret(this.secret, input.secret) : current || null;
    if (!secret && !input.url) throw new Error("MISSING_SECRET");
    await this.pool.query(
      `INSERT INTO integrations (service, public_config, secret_blob, active, updated_by)
       VALUES (?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE public_config = VALUES(public_config), secret_blob = VALUES(secret_blob), active = 1, updated_by = VALUES(updated_by)`,
      [input.service, JSON.stringify({ url: input.url }), secret, actorId],
    );
    await this.touchPlatform("integracoes", {}, actorId, ip, `Conectou ${input.service}`);
  }

  async issueToken(actorId: string, input: { nome: string; ambiente: string }, ip: string | null) {
    const raw = `gs_${input.ambiente === "producao" ? "live" : "test"}_${randomBytes(32).toString("base64url")}`;
    await this.pool.query(
      `INSERT INTO api_tokens (name, environment, token_hash, token_prefix, created_by) VALUES (?, ?, ?, ?, ?)`,
      [input.nome.slice(0, 120), input.ambiente, sha256(raw), raw.slice(0, 12), actorId],
    );
    await this.touchPlatform("api", {}, actorId, ip, "Emitiu um token de API");
    return raw;
  }

  async readMail(): Promise<ActiveMail | null> {
    const bundle = await this.readMailBundle();
    return bundle.config;
  }

  async readMailBundle(): Promise<MailBundle> {
    const platform = await this.platformRow();
    const publicConfig = readJson<MailPublic>(platform.mail_public) ?? {};
    const secrets = this.openSecrets(text(platform.mail_secrets));
    const method = text(platform.mail_method) === "smtp" ? "smtp" : "api";
    const provider = text(platform.mail_provider) || "resend";
    const slot = secrets[method === "smtp" ? "smtp" : provider] ?? {};
    const status = text(platform.mail_status);
    const mailStatus = status === "ativo" || status === "pendente" ? status : "ausente";
    const port = Number(publicConfig.port ?? 587);
    const config: ActiveMail = {
      method,
      provider,
      from: text(publicConfig.from),
      fromName: text(publicConfig.fromName) || "Grupo Sorrisos",
      signature: flag(platform.mail_signature, true),
      status: mailStatus,
      smtp: method === "smtp" ? {
        host: text(publicConfig.host),
        port: Number.isInteger(port) && port > 0 ? port : 587,
        user: text(publicConfig.user),
        password: slot.password ?? "",
        security: smtpSecurity(text(publicConfig.security) || "TLS"),
      } : null,
      apiKey: slot.apiKey ?? "",
      secretKey: slot.secretKey ?? "",
      domain: text(publicConfig.domain),
      region: text(publicConfig.region) || "us-east-1",
    };
    return {
      config,
      secrets,
      public: {
        host: text(publicConfig.host),
        port: text(publicConfig.port) || "587",
        user: text(publicConfig.user),
        security: text(publicConfig.security) || "TLS",
        from: text(publicConfig.from),
        fromName: text(publicConfig.fromName) || "Grupo Sorrisos",
        domain: text(publicConfig.domain),
        region: text(publicConfig.region) || "us-east-1",
      },
      weekly: flag(platform.mail_weekly, true),
      executive: flag(platform.mail_executive, true),
      signature: flag(platform.mail_signature, true),
    };
  }

  async writeMail(actorId: string, input: {
    method: "smtp" | "api";
    provider: string;
    public: MailBundle["public"];
    secrets: Record<string, MailSecretSlot>;
    weekly: boolean;
    executive: boolean;
    signature: boolean;
    status: "ausente" | "pendente" | "ativo";
    error: string | null;
  }, ip: string | null) {
    await this.touchPlatform("email", {
      mail_method: input.method,
      mail_provider: input.provider,
      mail_public: input.public,
      mail_secrets: sealSecret(this.secret, JSON.stringify(input.secrets)),
      mail_weekly: input.weekly ? 1 : 0,
      mail_executive: input.executive ? 1 : 0,
      mail_signature: input.signature ? 1 : 0,
      mail_status: input.status,
      mail_last_error: input.error,
    }, actorId, ip, "Atualizou o serviço de e-mail");
  }

  async automationFor(trigger: string) {
    const [rows] = await this.pool.query<SqlRow[]>(
      `SELECT action_code FROM automation_rules WHERE active = 1 AND trigger_code = ? ORDER BY id DESC LIMIT 1`,
      [trigger],
    );
    return rows[0] ? { acao: text(rows[0].action_code) } : null;
  }

  async sessionMinutes(userId: string) {
    const [rows] = await this.pool.query<SqlRow[]>(`SELECT session_minutes FROM user_preferences WHERE user_id = ?`, [userId]);
    const minutes = Number(rows[0]?.session_minutes ?? 15);
    const clamped = Number.isFinite(minutes) ? Math.min(1440, Math.max(5, Math.round(minutes))) : 15;
    return Math.max(clamped, 12 * 60) * 60;
  }

  async accessLogsEnabled() {
    const platform = await this.platformRow();
    return flag(platform.log_access, true);
  }

  async suspiciousAlertsEnabled() {
    const platform = await this.platformRow();
    return flag(platform.suspicious_login_alerts, true);
  }

  async allowedDomain() {
    const platform = await this.platformRow();
    return text(platform.allowed_domain);
  }

  private async platformRow() {
    await this.pool.query("INSERT IGNORE INTO platform_settings (id) VALUES (1)");
    const [rows] = await this.pool.query<SqlRow[]>(`SELECT * FROM platform_settings WHERE id = 1 LIMIT 1`);
    return rows[0] ?? {};
  }

  private async departmentId(name: string) {
    const [rows] = await this.pool.query<SqlRow[]>(`SELECT id FROM departments WHERE name = ? LIMIT 1`, [name]);
    return rows[0] ? String(rows[0].id) : null;
  }

  private openSecrets(payload: string) {
    if (!payload) return {};
    try {
      const parsed = JSON.parse(openSecret(this.secret, payload)) as unknown;
      if (!parsed || typeof parsed !== "object") return {};
      return parsed as Record<string, MailSecretSlot>;
    } catch {
      return {};
    }
  }

  private async touchUser(userId: string, module: string, columns: Record<string, string | number | null | object>, ip: string | null, message: string) {
    await this.pool.query("INSERT IGNORE INTO user_preferences (user_id) VALUES (?)", [userId]);
    const [rows] = await this.pool.query<SqlRow[]>(`SELECT touched FROM user_preferences WHERE user_id = ?`, [userId]);
    const touched = JSON.stringify(addTouched(rows[0]?.touched, module));
    const names = Object.keys(columns);
    for (const name of names) {
      if (!/^[a-z_]+$/.test(name)) throw new Error("COLUMN");
    }
    await this.pool.query(
      `UPDATE user_preferences SET ${[...names.map((name) => `${name} = ?`), "touched = ?"].join(", ")} WHERE user_id = ?`,
      [...names.map((name) => columns[name]), touched, userId],
    );
    await this.audit(userId, "user_preferences", userId, "UPDATE", message, ip);
  }

  private async touchPlatform(module: string, columns: Record<string, string | number | null | object>, actorId: string, ip: string | null, message: string) {
    await this.pool.query("INSERT IGNORE INTO platform_settings (id) VALUES (1)");
    const [rows] = await this.pool.query<SqlRow[]>(`SELECT touched FROM platform_settings WHERE id = 1`);
    const touched = JSON.stringify(addTouched(rows[0]?.touched, module));
    const names = Object.keys(columns);
    for (const name of names) {
      if (!/^[a-z_]+$/.test(name)) throw new Error("COLUMN");
    }
    const sets = [...names.map((name) => `${name} = ?`), "touched = ?"];
    const params = names.map((name) => {
      const value = columns[name];
      return value && typeof value === "object" ? JSON.stringify(value) : value;
    });
    await this.pool.query(`UPDATE platform_settings SET ${sets.join(", ")} WHERE id = 1`, [...params, touched]);
    await this.audit(actorId, "platform_settings", "1", "UPDATE", message, ip);
  }

  private async audit(userId: string, table: string, recordId: string, operation: string, message: string, ip: string | null) {
    try {
      await this.pool.query(
        `INSERT INTO audit_logs (user_id, table_name, record_id, operation, new_values, ip)
         VALUES (?, ?, ?, ?, JSON_OBJECT('message', ?), ?)`,
        [userId, table, recordId, operation, message.slice(0, 180), ip],
      );
    } catch {
      // Auditoria não pode desfazer a configuração.
    }
  }
}
