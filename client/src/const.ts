export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;

  // OAuth é opcional (ver .env.example: "Se não usar OAuth, deixe vazio").
  // Sem VITE_OAUTH_PORTAL_URL configurado, `new URL(`${undefined}/app-auth`)`
  // lançaria TypeError: Invalid URL e quebraria a aplicação inteira, já que
  // getLoginUrl() é chamado como valor padrão em useAuth() em quase toda
  // página. Sem OAuth configurado, cai para a página de login interna
  // (email/senha) que já existe em client/src/pages/Login.tsx.
  if (!oauthPortalUrl) {
    return "/login";
  }

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
