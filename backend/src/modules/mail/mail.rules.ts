import { createHash, createHmac, type BinaryLike } from "node:crypto";

export const MAIL_PROVIDERS = ["resend", "sendgrid", "mailgun", "ses", "postmark", "brevo", "mailjet", "sparkpost", "elastic"] as const;

export type MailProvider = (typeof MAIL_PROVIDERS)[number];

export function isMailProvider(value: string): value is MailProvider {
  return (MAIL_PROVIDERS as readonly string[]).includes(value);
}

export function smtpSecurity(value: string) {
  const text = value.trim().toLowerCase();
  if (text.includes("ssl") || text.includes("smtps")) return "ssl" as const;
  if (text === "none" || text === "off" || text.includes("sem") || text.includes("nenhum")) return "none" as const;
  return "tls" as const;
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: BinaryLike, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

export function awsAuthorization(input: {
  method: string;
  host: string;
  path: string;
  headers: Record<string, string>;
  body: string;
  region: string;
  service: string;
  accessKey: string;
  secretKey: string;
  amzDate: string;
}) {
  const dateStamp = input.amzDate.slice(0, 8);
  const payloadHash = sha256(input.body);
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.headers)) {
    headers[key.toLowerCase()] = value.trim().replace(/\s+/g, " ");
  }
  headers.host = input.host;
  headers["x-amz-date"] = input.amzDate;
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => `${name}:${headers[name]}\n`).join("");
  const signedHeaders = names.join(";");
  const canonical = [input.method.toUpperCase(), input.path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", input.amzDate, scope, sha256(canonical)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${input.secretKey}`, dateStamp), input.region), input.service), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    amzDate: input.amzDate,
    payloadHash,
  };
}

export function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function composeMail(text: string, html: string | undefined, signature: boolean) {
  const bodyHtml = html ?? `<p>${escapeHtml(text).replaceAll("\n", "<br>")}</p>`;
  if (!signature) return { text, html: bodyHtml };
  return {
    text: `${text}\n\n—\nGrupo Sorrisos`,
    html: `${bodyHtml}<hr><p style="color:#667085;font-size:12px">Grupo Sorrisos</p>`,
  };
}

export function fromHeader(email: string, name: string) {
  const trimmed = name.trim();
  return trimmed ? `${trimmed} <${email}>` : email;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validEmail(value: string) {
  const email = value.trim();
  return email.length <= 190 && emailPattern.test(email);
}

export type StageRole = "supplier" | "assignee" | "opener";

const stageRoleLabel: Record<StageRole, string> = {
  supplier: "fornecedor",
  assignee: "responsável da etapa",
  opener: "quem abriu o pedido",
};

export function stageRolePhrase(roles: StageRole[]) {
  const labels = roles.map((role) => stageRoleLabel[role]);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

export function stageNoticeMail(input: {
  number: string;
  branch: string;
  supplier?: string;
  fromStage: string;
  toStage: string;
  note: string;
  actor: string;
  roles: StageRole[];
}) {
  const rows = [
    ["Pedido", input.number],
    ["Filial", input.branch],
    ["Fornecedor", input.supplier ?? ""],
    ["Etapa anterior", input.fromStage],
    ["Etapa atual", input.toStage],
    ["Atualizado por", input.actor],
  ].filter(([, value]) => value.trim());
  const subject = `${input.number} — ${input.toStage}`.slice(0, 120);
  const text = [
    "Olá,",
    "",
    `O pedido ${input.number} mudou de etapa.`,
    ...rows.map(([label, value]) => `${label}: ${value}`),
    `Observação: ${input.note}`,
    "",
    `Você recebe este aviso como ${stageRolePhrase(input.roles)}.`,
  ].join("\n");
  const details = rows.map(([label, value]) => `<tr><td style="padding:8px 0;color:#667085;font-size:13px;width:140px;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:8px 0;color:#1f2937;font-size:14px;font-weight:600;">${escapeHtml(value)}</td></tr>`).join("");
  const html = `<div style="display:none;max-height:0;overflow:hidden;">O pedido ${escapeHtml(input.number)} agora está em ${escapeHtml(input.toStage)}.</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;margin:0;padding:24px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;font-family:Arial,Helvetica,sans-serif;"><tr><td style="padding:20px 24px;background:#0f766e;color:#ffffff;font-size:16px;font-weight:700;">Grupo Sorrisos</td></tr><tr><td style="padding:24px;"><p style="margin:0 0 8px;color:#111827;font-size:18px;font-weight:700;">Etapa atualizada</p><p style="margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.5;">O pedido <strong>${escapeHtml(input.number)}</strong> saiu de ${escapeHtml(input.fromStage)} e agora está em <strong>${escapeHtml(input.toStage)}</strong>.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${details}</table><p style="margin:16px 0 0;padding:12px;background:#f8fafc;border-radius:8px;color:#1f2937;font-size:14px;line-height:1.5;"><span style="color:#667085;">Observação</span><br>${escapeHtml(input.note)}</p><p style="margin:16px 0 0;color:#667085;font-size:12px;line-height:1.5;">Você recebe este aviso como ${escapeHtml(stageRolePhrase(input.roles))}.</p></td></tr></table></td></tr></table>`;
  return { subject, text, html };
}
