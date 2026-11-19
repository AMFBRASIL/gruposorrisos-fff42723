import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const KEY_LEN = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

/** Formato já gravado no banco: scrypt$N$r$p$saltHex$keyHex. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LEN, SCRYPT_OPTIONS);
  return `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    return bcrypt.compare(password, stored);
  }
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!n || !r || !p) return false;
  const expected = Buffer.from(parts[5] ?? "", "hex");
  if (expected.length === 0) return false;
  const actual = await scryptAsync(password, Buffer.from(parts[4] ?? "", "hex"), expected.length, {
    N: n,
    r,
    p,
    maxmem: SCRYPT_OPTIONS.maxmem,
  });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
