import { AppError } from "../../shared/errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import type { AuthRepository } from "./auth.repository.js";
import type { AuthResult, LoginMeta } from "./auth.types.js";
import { ACCESS_TTL_SECONDS, hashToken, newSessionToken, sessionExpiry, TokenService } from "./tokens.js";

const INVALID = new AppError(401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos.");

export type AuthPolicy = {
  accessTtlSeconds?: (userId: string) => Promise<number>;
  accessLogsEnabled?: () => Promise<boolean>;
  onNewIp?: (input: { email: string; name: string; ip: string; userAgent: string | null }) => Promise<void>;
};

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly tokens: TokenService,
    private readonly policy?: AuthPolicy,
  ) {}

  async login(input: { email: string; password: string; remember: boolean }, meta: LoginMeta): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.repository.findCredentials(email);
    if (!user || !user.passwordHash) throw INVALID;
    if (!user.active) throw new AppError(403, "USER_INACTIVE", "Usuário inativo. Procure o administrador.");
    if (user.locked) {
      throw new AppError(423, "ACCOUNT_LOCKED", "Conta temporariamente bloqueada por tentativas inválidas. Tente novamente em alguns minutos.");
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      await this.repository.registerFailure(user.id);
      throw INVALID;
    }

    const freshIp = meta.ip ? await this.repository.ipStatus(user.id, meta.ip) : "known";
    const refreshToken = newSessionToken();
    const expiresAt = sessionExpiry(input.remember);
    const sessionId = await this.repository.openSession({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      ip: meta.ip,
      userAgent: meta.userAgent,
      expiresAt,
    });
    if (await this.logsEnabled()) await this.repository.recordAudit(user.id, sessionId, "login", meta.ip);

    const profile = await this.repository.loadProfile(user.id);
    if (!profile) throw new AppError(401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos.");
    if (freshIp === "new" && meta.ip) {
      void this.policy?.onNewIp?.({ email: profile.email, name: profile.name, ip: meta.ip, userAgent: meta.userAgent }).catch(() => undefined);
    }
    const ttl = await this.ttl(profile.id);
    const accessToken = await this.tokens.signAccess(profile.id, sessionId, ttl);
    return { accessToken, expiresIn: ttl, user: profile, refreshToken, remember: input.remember };
  }

  async refresh(rawToken: string | undefined) {
    if (!rawToken) throw new AppError(401, "UNAUTHENTICATED", "Sessão expirada. Entre novamente.");
    const session = await this.repository.findActiveSessionByHash(hashToken(rawToken));
    if (!session) throw new AppError(401, "UNAUTHENTICATED", "Sessão expirada. Entre novamente.");
    const user = await this.repository.loadProfile(session.userId);
    if (!user) throw new AppError(401, "UNAUTHENTICATED", "Sessão expirada. Entre novamente.");
    const ttl = await this.ttl(user.id);
    const accessToken = await this.tokens.signAccess(user.id, session.id, ttl);
    await this.repository.extendSession(session.id, sessionExpiry(true));
    return { accessToken, expiresIn: ttl, user };
  }

  async me(authorization: string | undefined) {
    const claims = await this.readAccess(authorization);
    const session = await this.repository.findActiveSession(claims.sid);
    if (!session || session.userId !== claims.sub) {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão expirada. Entre novamente.");
    }
    const user = await this.repository.loadProfile(session.userId);
    if (!user) throw new AppError(401, "UNAUTHENTICATED", "Sessão expirada. Entre novamente.");
    return { user };
  }

  async changePassword(authorization: string | undefined, currentPassword: string, nextPassword: string) {
    const claims = await this.readAccess(authorization);
    const stored = await this.repository.passwordHash(claims.sub);
    if (!stored || !(await verifyPassword(currentPassword, stored))) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Senha atual incorreta.");
    }
    if (nextPassword.trim().length < 8) {
      throw new AppError(400, "VALIDATION", "A nova senha precisa ter ao menos 8 caracteres.");
    }
    await this.repository.setPassword(claims.sub, await hashPassword(nextPassword));
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    const session = await this.repository.findActiveSessionByHash(hashToken(rawToken));
    await this.repository.revokeByHash(hashToken(rawToken));
    if (session && await this.logsEnabled()) await this.repository.recordAudit(session.userId, session.id, "logout", null);
  }

  private async ttl(userId: string) {
    if (!this.policy?.accessTtlSeconds) return ACCESS_TTL_SECONDS;
    try {
      const seconds = await this.policy.accessTtlSeconds(userId);
      if (!Number.isFinite(seconds) || seconds < 60) return ACCESS_TTL_SECONDS;
      return Math.round(seconds);
    } catch {
      return ACCESS_TTL_SECONDS;
    }
  }

  private async logsEnabled() {
    if (!this.policy?.accessLogsEnabled) return true;
    try {
      return await this.policy.accessLogsEnabled();
    } catch {
      return true;
    }
  }

  private async readAccess(authorization: string | undefined) {
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim();
    if (!token) throw new AppError(401, "UNAUTHENTICATED", "Sessão expirada. Entre novamente.");
    try {
      return await this.tokens.verifyAccess(token);
    } catch {
      throw new AppError(401, "UNAUTHENTICATED", "Sessão expirada. Entre novamente.");
    }
  }
}
