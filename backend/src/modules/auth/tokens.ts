import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Env } from "../../config/env.js";

const ISSUER = "gruposorrisos-backend";
const AUDIENCE = "gruposorrisos-web";

export type AccessClaims = { sub: string; sid: string };

export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const SESSION_DAYS = { short: 30, long: 90 } as const;

export function sessionExpiry(remember: boolean, now = new Date()) {
  const days = remember ? SESSION_DAYS.long : SESSION_DAYS.short;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export class TokenService {
  private readonly key: Uint8Array;

  constructor(private readonly env: Env) {
    this.key = new TextEncoder().encode(env.JWT_SECRET);
  }

  async signAccess(userId: string, sessionId: string, ttlSeconds = ACCESS_TTL_SECONDS) {
    const seconds = Math.min(Math.max(Math.round(ttlSeconds), 60), 24 * 60 * 60);
    return new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime(`${seconds}s`)
      .sign(this.key);
  }

  async verifyAccess(token: string): Promise<AccessClaims> {
    const { payload } = await jwtVerify(token, this.key, { issuer: ISSUER, audience: AUDIENCE });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
      throw new Error("Token sem identidade.");
    }
    return { sub: payload.sub, sid: payload.sid };
  }
}

export const ACCESS_TTL_SECONDS = 15 * 60;
