import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === "") return fallback;
  return value.trim().toLowerCase() === "true";
}

function parseSameSite(value: string | undefined): CookieOptions["sameSite"] {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "strict" || normalized === "none") return normalized;
  return "lax";
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const requestIsSecure = isSecureRequest(req);
  const configuredSameSite = parseSameSite(process.env.COOKIE_SAME_SITE);
  const configuredSecure = parseBoolean(
    process.env.COOKIE_SECURE,
    process.env.NODE_ENV === "production"
  );

  // Navegadores rejeitam cookies SameSite=None sem Secure. Em desenvolvimento
  // HTTP, recuamos para Lax para que login/logout continuem funcionais.
  const secure = configuredSecure && requestIsSecure;
  const sameSite = configuredSameSite === "none" && !secure
    ? "lax"
    : configuredSameSite;

  return {
    httpOnly: parseBoolean(process.env.COOKIE_HTTP_ONLY, true),
    path: "/",
    sameSite,
    secure,
  };
}
