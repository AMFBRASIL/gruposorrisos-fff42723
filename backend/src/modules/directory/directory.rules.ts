const ROLE_RANK = ["superadmin", "diretoria", "gerente", "regional", "comprador", "estoquista-central", "estoquista-local", "auditor", "colaborador"];

const PROFILE_BY_ROLE: Record<string, string> = {
  superadmin: "diretor",
  diretoria: "diretor",
  auditor: "diretor",
  gerente: "gerente",
  regional: "gerente",
  comprador: "gerente",
  "estoquista-central": "supervisor",
  "estoquista-local": "supervisor",
  colaborador: "colaborador",
};

export function profileCodeForRoles(roleCodes: string[]) {
  const ranked = [...roleCodes].sort((a, b) => {
    const left = ROLE_RANK.indexOf(a);
    const right = ROLE_RANK.indexOf(b);
    return (left === -1 ? ROLE_RANK.length : left) - (right === -1 ? ROLE_RANK.length : right);
  });
  return PROFILE_BY_ROLE[ranked[0] ?? ""] ?? "colaborador";
}

export function profileCodeFromName(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "perfil";
}

export function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "GS";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function temporaryPassword(bytes: Uint8Array) {
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}
