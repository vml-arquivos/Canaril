import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const FORMAT = "scrypt";
const VERSION = "1";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PARAMS = { N: 16_384, r: 8, p: 1 } as const;
const LEGACY_SALT = "canaril-salt";

export type PasswordVerification = {
  valid: boolean;
  needsRehash: boolean;
};

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Gera um hash versionado com sal aleatório por usuário usando o scrypt nativo
 * do Node. Não adiciona dependência externa e continua compatível com os
 * ambientes atuais do sistema.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = (await scrypt(password, salt, KEY_LENGTH, PARAMS)) as Buffer;
  return [
    FORMAT,
    VERSION,
    String(PARAMS.N),
    String(PARAMS.r),
    String(PARAMS.p),
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

function isLegacyHash(storedHash: string): boolean {
  return /^[a-f0-9]{128}$/i.test(storedHash);
}

/**
 * Valida hashes novos e o hash legado com sal fixo. Quando um hash legado é
 * aceito, `needsRehash` informa ao login que ele deve ser migrado imediatamente
 * para o formato seguro, sem bloquear usuários existentes.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<PasswordVerification> {
  if (!storedHash) return { valid: false, needsRehash: false };

  if (isLegacyHash(storedHash)) {
    const derived = (await scrypt(password, LEGACY_SALT, KEY_LENGTH)) as Buffer;
    const expected = Buffer.from(storedHash, "hex");
    return { valid: safeEqual(derived, expected), needsRehash: true };
  }

  const [format, version, nRaw, rRaw, pRaw, saltRaw, hashRaw, ...extra] = storedHash.split("$");
  if (
    format !== FORMAT ||
    version !== VERSION ||
    extra.length > 0 ||
    !nRaw || !rRaw || !pRaw || !saltRaw || !hashRaw
  ) {
    return { valid: false, needsRehash: false };
  }

  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || N < 2 || r < 1 || p < 1) {
    return { valid: false, needsRehash: false };
  }

  try {
    const salt = Buffer.from(saltRaw, "base64url");
    const expected = Buffer.from(hashRaw, "base64url");
    const derived = (await scrypt(password, salt, expected.length, { N, r, p })) as Buffer;
    const valid = safeEqual(derived, expected);
    const needsRehash = valid && (N !== PARAMS.N || r !== PARAMS.r || p !== PARAMS.p || expected.length !== KEY_LENGTH);
    return { valid, needsRehash };
  } catch {
    return { valid: false, needsRehash: false };
  }
}
