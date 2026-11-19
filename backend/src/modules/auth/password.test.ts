import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "./password.js";

test("hash scrypt confere a senha original e rejeita outra", async () => {
  const hash = await hashPassword("correta-123");
  assert.equal(hash.startsWith("scrypt$16384$8$1$"), true);
  assert.equal(hash.includes("correta-123"), false);
  assert.equal(await verifyPassword("correta-123", hash), true);
  assert.equal(await verifyPassword("errada", hash), false);
  assert.equal(await verifyPassword("correta-123", "texto-puro"), false);
});
