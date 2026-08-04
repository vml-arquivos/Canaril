import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

describe("password", () => {
  it("usa sal aleatório e valida a senha", async () => {
    const a = await hashPassword("Senha-Forte-123");
    const b = await hashPassword("Senha-Forte-123");
    expect(a).not.toBe(b);
    expect((await verifyPassword("Senha-Forte-123", a)).valid).toBe(true);
    expect((await verifyPassword("errada", a)).valid).toBe(false);
  });

  it("aceita hash legado e solicita rehash", async () => {
    const legacy = ((await scrypt("senha-legada", "canaril-salt", 64)) as Buffer).toString("hex");
    const result = await verifyPassword("senha-legada", legacy);
    expect(result).toEqual({ valid: true, needsRehash: true });
  });
});
