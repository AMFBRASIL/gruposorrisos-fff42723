import assert from "node:assert/strict";
import { test } from "node:test";
import { initialsFrom, profileCodeForRoles, profileCodeFromName, temporaryPassword } from "./directory.rules.js";

test("escolhe o perfil de páginas pelo papel mais amplo", () => {
  assert.equal(profileCodeForRoles(["colaborador", "superadmin"]), "diretor");
  assert.equal(profileCodeForRoles(["estoquista-local"]), "supervisor");
  assert.equal(profileCodeForRoles([]), "colaborador");
});

test("gera código estável a partir do nome", () => {
  assert.equal(profileCodeFromName("Coordenador(a)"), "coordenador-a");
  assert.equal(profileCodeFromName("   "), "perfil");
});

test("monta iniciais e senha temporária sem caracteres ambíguos", () => {
  assert.equal(initialsFrom("Maria Fernanda Costa"), "MC");
  const password = temporaryPassword(Uint8Array.from([0, 10, 20, 30]));
  assert.equal(password.length, 4);
  assert.match(password, /^[A-Za-z0-9]+$/);
  assert.doesNotMatch(password, /[0OIl1]/);
});
