export const SETTINGS_MODULES = [
  "perfil", "aparencia", "notificacoes", "idioma", "equipe", "kanban", "automacoes", "atividades",
  "email", "integracoes", "ia", "api", "seguranca", "privacidade", "backup",
] as const;

export type SettingsModule = (typeof SETTINGS_MODULES)[number];

const ACCOUNT_MODULES = new Set<SettingsModule>(["perfil", "aparencia", "notificacoes", "idioma", "privacidade", "seguranca"]);

export function isSettingsModule(value: string): value is SettingsModule {
  return (SETTINGS_MODULES as readonly string[]).includes(value);
}

export function isAccountModule(module: SettingsModule) {
  return ACCOUNT_MODULES.has(module);
}

export function domainAllowed(email: string, domain: string) {
  const expected = domain.trim().toLowerCase();
  if (!expected) return true;
  const suffix = expected.startsWith("@") ? expected : `@${expected}`;
  return email.trim().toLowerCase().endsWith(suffix);
}

export function normalizeDomain(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  const withAt = trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
  if (!/^@[a-z0-9.-]+\.[a-z]{2,}$/.test(withAt)) throw new Error("DOMAIN");
  return withAt;
}

export function parseClock(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error("CLOCK");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error("CLOCK");
  return `${match[1]}:${match[2]}`;
}

export function clampInt(value: string, min: number, max: number) {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

export function blankSecret(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" || trimmed === "••••••••";
}

export function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T) {
  return allowed.includes(value as T) ? value as T : fallback;
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "GS";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}
