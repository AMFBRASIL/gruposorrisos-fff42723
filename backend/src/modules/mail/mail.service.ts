import nodemailer from "nodemailer";
import type { SettingsRepository } from "../settings/settings.repository.js";
import { awsAuthorization, composeMail, fromHeader, isMailProvider } from "./mail.rules.js";
import { MailDeliveryError, type ActiveMail, type OutboundMail } from "./mail.types.js";

// Serviço geral de e-mail. Os demais módulos chamam send(); a tela de configurações grava a conta e confirma o envio.
export class MailService {
  constructor(private readonly settings: SettingsRepository) {}

  async send(message: OutboundMail) {
    const config = await this.settings.readMail();
    if (!config || config.status !== "ativo") return { delivered: false, reason: "E-mail não configurado." };
    try {
      await this.deliver(config, message);
      return { delivered: true };
    } catch (error) {
      const reason = error instanceof MailDeliveryError ? error.message : "Falha no envio.";
      return { delivered: false, reason };
    }
  }

  async deliver(config: ActiveMail, message: OutboundMail) {
    const body = composeMail(message.text, message.html, config.signature);
    if (config.method === "smtp") {
      if (!config.smtp?.host || !config.from) throw new MailDeliveryError("Servidor SMTP incompleto.");
      await this.deliverSmtp(config, message, body);
      return;
    }
    if (!isMailProvider(config.provider)) throw new MailDeliveryError("Provedor de e-mail não suportado.");
    if (!config.apiKey || !config.from) throw new MailDeliveryError("Credenciais de API incompletas.");
    await this.deliverApi(config, message, body);
  }

  private async deliverSmtp(config: ActiveMail, message: OutboundMail, body: { text: string; html: string }) {
    const smtp = config.smtp!;
    const secure = smtp.security === "ssl" || smtp.port === 465;
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure,
      requireTLS: smtp.security === "tls" && !secure,
      ignoreTLS: smtp.security === "none",
      auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
    try {
      await transporter.sendMail({
        from: fromHeader(config.from, config.fromName),
        to: message.to,
        subject: message.subject,
        text: body.text,
        html: body.html,
      });
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
      if (code === "EAUTH") throw new MailDeliveryError("O servidor SMTP recusou o usuário ou a senha.");
      if (code === "ESOCKET" || code === "ECONNECTION" || code === "ETIMEDOUT" || code === "EDNS" || code === "ENOTFOUND") {
        throw new MailDeliveryError("Não foi possível conectar ao servidor SMTP.");
      }
      throw new MailDeliveryError("O servidor SMTP não aceitou a mensagem.");
    }
  }

  private async deliverApi(config: ActiveMail, message: OutboundMail, body: { text: string; html: string }) {
    const from = fromHeader(config.from, config.fromName);
    const provider = config.provider;
    if (provider === "resend") {
      await postJson("https://api.resend.com/emails", { Authorization: `Bearer ${config.apiKey}` }, {
        from, to: [message.to], subject: message.subject, text: body.text, html: body.html,
      });
      return;
    }
    if (provider === "sendgrid") {
      await postJson("https://api.sendgrid.com/v3/mail/send", { Authorization: `Bearer ${config.apiKey}` }, {
        personalizations: [{ to: [{ email: message.to }] }],
        from: { email: config.from, name: config.fromName || undefined },
        subject: message.subject,
        content: [{ type: "text/plain", value: body.text }, { type: "text/html", value: body.html }],
      });
      return;
    }
    if (provider === "mailgun") {
      if (!config.domain) throw new MailDeliveryError("Informe o domínio de envio do Mailgun.");
      const form = new URLSearchParams({ from, to: message.to, subject: message.subject, text: body.text, html: body.html });
      await postRaw(`https://api.mailgun.net/v3/${encodeURIComponent(config.domain)}/messages`, {
        Authorization: `Basic ${Buffer.from(`api:${config.apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      }, form.toString());
      return;
    }
    if (provider === "postmark") {
      await postJson("https://api.postmarkapp.com/email", { "X-Postmark-Server-Token": config.apiKey }, {
        From: from, To: message.to, Subject: message.subject, TextBody: body.text, HtmlBody: body.html, MessageStream: "outbound",
      });
      return;
    }
    if (provider === "brevo") {
      await postJson("https://api.brevo.com/v3/smtp/email", { "api-key": config.apiKey }, {
        sender: { email: config.from, name: config.fromName || undefined },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: body.text,
        htmlContent: body.html,
      });
      return;
    }
    if (provider === "mailjet") {
      const [key, secret] = config.apiKey.split(":");
      if (!key || !secret) throw new MailDeliveryError("A chave do Mailjet precisa estar no formato chave:segredo.");
      await postJson("https://api.mailjet.com/v3.1/send", {
        Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
      }, {
        Messages: [{
          From: { Email: config.from, Name: config.fromName || undefined },
          To: [{ Email: message.to }],
          Subject: message.subject,
          TextPart: body.text,
          HTMLPart: body.html,
        }],
      });
      return;
    }
    if (provider === "sparkpost") {
      await postJson("https://api.sparkpost.com/api/v1/transmissions", { Authorization: config.apiKey }, {
        recipients: [{ address: message.to }],
        content: { from, subject: message.subject, text: body.text, html: body.html },
      });
      return;
    }
    if (provider === "elastic") {
      await postJson("https://api.elasticemail.com/v4/emails/transactional", { "X-ElasticEmail-ApiKey": config.apiKey }, {
        Recipients: { To: [message.to] },
        Content: {
          From: from,
          Subject: message.subject,
          Body: [{ ContentType: "PlainText", Content: body.text }, { ContentType: "HTML", Content: body.html }],
        },
      });
      return;
    }
    await this.deliverSes(config, message, body);
  }

  private async deliverSes(config: ActiveMail, message: OutboundMail, body: { text: string; html: string }) {
    if (!config.secretKey) throw new MailDeliveryError("Informe a secret key da AWS.");
    if (!/^[a-z]{2}-[a-z]+-\d+$/.test(config.region)) throw new MailDeliveryError("Região AWS inválida.");
    const host = `email.${config.region}.amazonaws.com`;
    const payload = JSON.stringify({
      FromEmailAddress: fromHeader(config.from, config.fromName),
      Destination: { ToAddresses: [message.to] },
      Content: { Simple: { Subject: { Data: message.subject, Charset: "UTF-8" }, Body: { Text: { Data: body.text, Charset: "UTF-8" }, Html: { Data: body.html, Charset: "UTF-8" } } } },
    });
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const signed = awsAuthorization({
      method: "POST",
      host,
      path: "/v2/email/outbound-emails",
      headers: { "content-type": "application/json" },
      body: payload,
      region: config.region,
      service: "ses",
      accessKey: config.apiKey,
      secretKey: config.secretKey,
      amzDate,
    });
    await postRaw(`https://${host}/v2/email/outbound-emails`, {
      "content-type": "application/json",
      "x-amz-date": signed.amzDate,
      Authorization: signed.authorization,
    }, payload);
  }
}

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  await postRaw(url, { ...headers, "Content-Type": "application/json" }, JSON.stringify(body));
}

async function postRaw(url: string, headers: Record<string, string>, body: string) {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(10000) });
  } catch {
    throw new MailDeliveryError("Não foi possível contactar o provedor de e-mail.");
  }
  if (response.ok) return;
  if (response.status === 401 || response.status === 403) throw new MailDeliveryError("O provedor recusou a credencial.");
  throw new MailDeliveryError(`O provedor recusou o envio (${response.status}).`);
}
