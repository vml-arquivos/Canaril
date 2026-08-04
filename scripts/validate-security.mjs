import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../server/_core/password.ts";
import { generateBatchCodes } from "../server/_core/ringParser.ts";

const password = "Senha-forte-de-validacao-2026";
const first = await hashPassword(password);
const second = await hashPassword(password);
assert.notEqual(first, second, "o sal deve ser individual e aleatório");
assert.equal((await verifyPassword(password, first)).valid, true);
assert.equal((await verifyPassword("senha-incorreta", first)).valid, false);
assert.equal(first.startsWith("scrypt$1$"), true);

const codes = generateBatchCodes({
  breederCode: "GF-003",
  year: 2026,
  startNumber: 1,
  endNumber: 50,
  formatPattern: "{breederCode}-{year}-{seq}",
});
assert.equal(codes.length, 50);
assert.equal(new Set(codes.map((item) => item.fullCode)).size, 50);
assert.equal(codes[0].fullCode, "GF-003-2026-001");
assert.equal(codes[49].fullCode, "GF-003-2026-050");

console.log("PASS  scrypt usa sal individual e valida corretamente");
console.log("PASS  senha incorreta é rejeitada");
console.log("PASS  lote gera 50 códigos únicos e ordenados");
