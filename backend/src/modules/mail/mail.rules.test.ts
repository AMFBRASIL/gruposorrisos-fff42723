import assert from "node:assert/strict";
import test from "node:test";
import { openSecret, sealSecret } from "../../shared/secret-box.js";
import { awsAuthorization, composeMail, smtpSecurity, stageNoticeMail, validEmail } from "./mail.rules.js";

test("assinatura AWS SigV4 do exemplo oficial", () => {
  const signed = awsAuthorization({
    method: "POST",
    host: "iam.amazonaws.com",
    path: "/",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8" },
    body: "Action=ListUsers&Version=2010-05-08",
    region: "us-east-1",
    service: "iam",
    accessKey: "AKIDEXAMPLE",
    secretKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
    amzDate: "20150830T123600Z",
  });
  assert.equal(signed.payloadHash, "b6359072c78d70ebee1e81adcbab4f01bf2c23245fa365ef83fe8f1f955085e2");
  assert.equal(
    signed.authorization,
    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=5d76d0de3e0ffe5a7a23cfce21b99d6f4e5060aad86bd9dc7c617f224e5b492a",
  );
});

test("segurança SMTP aceita TLS, SSL e nenhuma", () => {
  assert.equal(smtpSecurity("TLS"), "tls");
  assert.equal(smtpSecurity("STARTTLS"), "tls");
  assert.equal(smtpSecurity("SSL"), "ssl");
  assert.equal(smtpSecurity("sem criptografia"), "none");
});

test("assinatura HTML só entra quando está ligada", () => {
  const plain = composeMail("Olá", undefined, false);
  assert.equal(plain.text, "Olá");
  assert.equal(plain.html.includes("Grupo Sorrisos</p>"), false);
  const signed = composeMail("Olá <admin>", undefined, true);
  assert.equal(signed.text.endsWith("Grupo Sorrisos"), true);
  assert.equal(signed.html.includes("Olá &lt;admin&gt;"), true);
});

test("aviso de etapa cabe em um e-mail simples", () => {
  assert.equal(validEmail("compras@dentalprime.com.br"), true);
  assert.equal(validEmail("sem-arroba"), false);
  const mail = stageNoticeMail({
    number: "FOR-000003",
    branch: "Centro de Distribuição",
    supplier: "Dental Prime",
    fromStage: "Aguardando Cotação",
    toStage: "Em Cotação",
    note: "Cotação <urgente> & conferida",
    actor: "Administrador",
    roles: ["supplier", "assignee", "opener"],
  });
  assert.equal(mail.subject, "FOR-000003 — Em Cotação");
  assert.equal(mail.text.includes("Cotação <urgente> & conferida"), true);
  assert.equal(mail.html.includes("<script"), false);
  assert.equal(mail.html.includes("http://"), false);
  assert.equal(mail.html.includes("https://"), false);
  assert.equal(mail.html.includes("Cotação &lt;urgente&gt; &amp; conferida"), true);
  assert.equal(mail.html.includes("fornecedor, responsável da etapa e quem abriu o pedido"), true);
});

test("segredo cifrado não guarda o texto original", () => {
  const sealed = sealSecret("chave-de-teste", "re_segredo");
  assert.equal(sealed.includes("re_segredo"), false);
  assert.equal(openSecret("chave-de-teste", sealed), "re_segredo");
});
