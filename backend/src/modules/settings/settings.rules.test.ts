import assert from "node:assert/strict";
import test from "node:test";
import { blankSecret, domainAllowed, normalizeDomain, parseClock } from "./settings.rules.js";

test("domínio vazio libera qualquer e-mail e domínio preenchido restringe", () => {
  assert.equal(domainAllowed("admin@gruposorrisos.com.br", ""), true);
  assert.equal(domainAllowed("admin@gruposorrisos.com.br", "@gruposorrisos.com.br"), true);
  assert.equal(domainAllowed("admin@gruposorrisos.com", "@gruposorrisos.com.br"), false);
  assert.equal(normalizeDomain("gruposorrisos.com.br"), "@gruposorrisos.com.br");
  assert.throws(() => normalizeDomain("invalido"), /DOMAIN/);
});

test("horário e segredo em branco", () => {
  assert.equal(parseClock("03:00"), "03:00");
  assert.throws(() => parseClock("3:00"), /CLOCK/);
  assert.equal(blankSecret(""), true);
  assert.equal(blankSecret("••••••••"), true);
  assert.equal(blankSecret("nova-senha"), false);
});
