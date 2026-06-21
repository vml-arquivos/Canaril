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
