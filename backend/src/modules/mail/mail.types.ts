export type OutboundMail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type ActiveMail = {
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

export class MailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailDeliveryError";
  }
}
