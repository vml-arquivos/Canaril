export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  adminName: process.env.ADMIN_NAME ?? process.env.OWNER_NAME ?? "Administrador",
  adminEmail: process.env.ADMIN_EMAIL ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Chave da API da Anthropic (https://console.anthropic.com), usada pelo
  // Juiz Virtual, identificação de espécie/cor por foto e recomendação de
  // cruzamento. Sem ela, esses recursos de IA ficam indisponíveis (o resto
  // do sistema funciona normalmente).
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  // Chave da API do Gemini (https://aistudio.google.com/apikey). Se
  // configurada, o sistema usa o Gemini em vez da Anthropic pra todos os
  // recursos de IA — ver server/_core/llm.ts. As duas podem coexistir;
  // o Gemini tem prioridade quando ambas estão configuradas.
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModelVision: process.env.GEMINI_MODEL_VISION ?? "",
  geminiModelPro: process.env.GEMINI_MODEL_PRO ?? "",
  // Diretório local onde fotos e outros arquivos enviados pelo sistema são
  // gravados em disco. Deve apontar para um volume persistente montado no
  // Coolify (Configuration > Persistent Storage), senão os arquivos somem
  // a cada novo deploy/restart do container.
  uploadsDir: process.env.UPLOADS_DIR ?? "/app/uploads",
};


const PLACEHOLDER_MARKERS = ["troque", "change-me", "changeme", "example", "senha@123"];

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

/** Validação de produção: somente requisitos críticos bloqueiam a inicialização. */
export function validateProductionEnvironment(): void {
  if (!ENV.isProduction) return;

  const errors: string[] = [];
  if (!ENV.databaseUrl || isPlaceholder(ENV.databaseUrl)) {
    errors.push("DATABASE_URL ausente ou com valor de exemplo");
  }
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 32 || isPlaceholder(ENV.cookieSecret)) {
    errors.push("JWT_SECRET deve possuir pelo menos 32 caracteres e não pode ser placeholder");
  }
  const port = Number(process.env.PORT ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push("PORT inválida");
  }
  // Compatibilidade de produção: ADMIN_PASSWORD pertence ao fluxo legado de
  // bootstrap e não pode impedir o servidor de subir. Ambientes já em produção
  // podem possuir uma senha antiga/curta; bloquear o processo aqui derruba o
  // deploy inteiro antes do healthcheck. Mantemos o alerta de segurança, mas a
  // aplicação continua disponível para que a credencial seja rotacionada sem
  // indisponibilidade.
  if (ENV.adminPassword && (ENV.adminPassword.length < 12 || isPlaceholder(ENV.adminPassword))) {
    console.warn(
      "[Environment] Aviso: ADMIN_PASSWORD está fraca/placeholder. O sistema continuará iniciando por compatibilidade; altere a credencial no Coolify assim que possível."
    );
  }

  if (errors.length > 0) {
    throw new Error(`[Environment] Configuração de produção inválida: ${errors.join("; ")}`);
  }
}
