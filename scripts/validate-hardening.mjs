import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const passes = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function check(name, condition, detail) {
  if (condition) passes.push(name);
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

function contains(file, pattern) {
  const content = read(file);
  return typeof pattern === "string" ? content.includes(pattern) : pattern.test(content);
}

check("segredo de produção não versionado", !fs.existsSync(path.join(root, ".env.production")));
check("exemplo de ambiente presente", fs.existsSync(path.join(root, ".env.production.example")));

const envFiles = fs.readdirSync(root).filter((name) => name.startsWith(".env"));
const unexpectedEnvFiles = envFiles.filter((name) => ![".env.example", ".env.production.example"].includes(name));
const leaked = unexpectedEnvFiles;

check("nenhum arquivo de ambiente real versionado", leaked.length === 0, leaked.join(", "));
const deploymentDocs = ["README.md", "DEPLOYMENT_CHECKLIST.md", "DEPLOY_VPS_FINAL.md", "DEPLOY_GUIDE.md", "DOCKER_DEPLOY.md", "COOLIFY_CONFIGURATION.md"]
  .filter((file) => fs.existsSync(path.join(root, file)))
  .map(read)
  .join("\n");
const documentedCredentialValues = [...deploymentDocs.matchAll(
  /(?:API_KEY|SECRET|TOKEN)\s*[=:]\s*([A-Za-z0-9+/=_-]{20,})/gi,
)].map((match) => match[1]);
const suspiciousDocumentedCredentials = documentedCredentialValues.filter(
  (value) => !/^(?:GERAR_|CHANGE_|REPLACE_|YOUR_|EXEMPLO_)/i.test(value),
);
check(
  "documentação sem credenciais históricas expostas",
  suspiciousDocumentedCredentials.length === 0 &&
    !/[a-f0-9]{64}/i.test(deploymentDocs) &&
    !deploymentDocs.includes("POSTGRES_PASSWORD=postgis") &&
    !deploymentDocs.includes("Password = postgis"),
);

const adminReset = read("server/routers/adminReset.ts");
check("reset administrativo restrito", !adminReset.includes("protectedProcedure") && adminReset.includes("platformAdminProcedure"));
check("VIEWER sem mutações", contains("server/_core/trpc.ts", /VIEWER[\s\S]*mutation/i));
check("senha com sal aleatório", contains("server/_core/password.ts", "randomBytes") && contains("server/_core/password.ts", "scrypt") && contains("server/_core/password.ts", "timingSafeEqual"));
check("cookies respeitam HTTPS e SameSite", contains("server/_core/cookies.ts", "requestIsSecure") && contains("server/_core/cookies.ts", "sameSite"));
check("IA filtrada por tenant", contains("server/_core/aiContextBuilder.ts", /tenantId/) && contains("server/_core/aiContextBuilder.ts", /health/i));
check("lotes de anilhas transacionais", contains("server/_core/ringBatchService.ts", "BEGIN") && contains("server/_core/ringBatchService.ts", "ROLLBACK"));
check("anilhamento e promoção transacionais", contains("server/_core/ringPromotion.ts", "FOR UPDATE OF r SKIP LOCKED") && contains("server/_core/ringPromotion.ts", "ROLLBACK"));
check("anilha aplicada não volta ao estoque", !contains("server/routers/rings.ts", /SET status\s*=\s*'available',[^;]*"usedAt"\s*=\s*NULL/s));
check(
  "reconciliação administrativa preserva anilha usada",
  contains("server/_core/adminReset/resetExecutor.ts", /SET status\s*=\s*'used'/) &&
    !contains("server/_core/adminReset/resetExecutor.ts", /SET status\s*=\s*'available'[^;]*"birdId"\s*=\s*NULL[^;]*"usedAt"\s*=\s*NULL/s),
);
check(
  "operações opcionais de reset usam savepoint",
  contains("server/_core/adminReset/resetExecutor.ts", "SAVEPOINT") &&
    contains("server/_core/adminReset/resetExecutor.ts", "ROLLBACK TO SAVEPOINT"),
);
check(
  "vínculo de anilha valida o código cadastrado no pássaro",
  contains("server/_core/ringAllocator.ts", "birdResult.rows[0].ring !== fullCode") &&
    contains("server/_core/ringAllocator.ts", 'WHERE "birdId" = $1 AND id <> $2'),
);
check(
  "liberação de anilha aplicada está bloqueada",
  contains("server/_core/ringAllocator.ts", "Uma anilha aplicada não pode voltar ao estoque"),
);
check("ciclo do filhote permite dados posteriores", contains("drizzle/migrations/0026_security_ring_lifecycle.sql", "ALTER COLUMN ring DROP NOT NULL") && contains("drizzle/migrations/0026_security_ring_lifecycle.sql", 'ADD COLUMN IF NOT EXISTS "hatchDateTime"'));
check(
  "eclosão possui rastreabilidade individual",
  contains("drizzle/schema.ts", 'hatchLogId: integer("hatchLogId")') &&
    fs.existsSync(path.join(root, "drizzle/migrations/0027_hatch_log_traceability.sql")) &&
    contains("server/routers/dailyCare.ts", '"hatchLogId", "birthDateSource"'),
);
check(
  "correção de eclosão é transacional e protege filhotes aplicados",
  contains("server/routers/dailyCare.ts", "FOR UPDATE OF l, c") &&
    contains("server/routers/dailyCare.ts", "registro de eclosão legado") &&
    contains("server/routers/dailyCare.ts", "com status alterado, anilhados"),
);
check("backfill multi-tenant de anilhas", fs.existsSync(path.join(root, "drizzle/migrations/0025_backfill_ring_tenant.sql")));
check("guia FOB 2026 corrigido", contains("client/src/pages/GuiasPublico.tsx", /canários de cor e Gloster.*3,0 mm/s));
check("Pastel configurado como sexo-ligado", contains("server/_core/colorGenetics.ts", /pastel:\s*\{[\s\S]*?inheritance:\s*"sex_linked"/));
check("Opalino configurado como autossômico recessivo", contains("server/_core/colorGenetics.ts", /opalino:\s*\{[\s\S]*?inheritance:\s*"autosomal_recessive"/));
check("Topázio provisório não selecionável", contains("server/_core/colorGenetics.ts", /topazio:\s*\{[\s\S]*?selectable:\s*false/));
check("cadastro de pássaro e anilha atômico", contains("server/routers/birds.ts", "createBirdAtomic") && contains("server/routers/birds.ts", "FOR UPDATE"));
check(
  "compatibilidade de anilha usa bitola física",
  contains("server/_core/ringCompatibility.ts", "assessRingCompatibility") &&
    contains("server/_core/ringPromotion.ts", "assessRingCompatibility") &&
    contains("server/_core/ringAllocator.ts", "assessRingCompatibility"),
);
check(
  "cadastro valida bitola antes de vincular anilha",
  contains("server/routers/birds.ts", "A anilha selecionada não é compatível") &&
    contains("server/routers/birds.ts", 'FROM ring_gauge_rules'),
);
check(
  "formulário sugere anilha conforme classificação",
  contains("client/src/pages/Birds.tsx", "speciesName: formData.speciesName") &&
    contains("client/src/pages/Birds.tsx", "breedName: formData.breedName") &&
    contains("client/src/pages/Birds.tsx", "autoSuggestedRing"),
);
check(
  "bitolas oficiais possuem migração corretiva",
  fs.existsSync(path.join(root, "drizzle/migrations/0028_correct_official_ring_gauges.sql")) &&
    contains("drizzle/migrations/0028_correct_official_ring_gauges.sql", "FOB/OBJO 2026"),
);
check(
  "código completo de anilha possui capacidade uniforme",
  fs.existsSync(path.join(root, "drizzle/migrations/0029_expand_ring_code_capacity.sql")) &&
    contains("drizzle/schema.ts", 'number: varchar("number", { length: 100 })') &&
    contains("drizzle/schema.ts", 'ring: varchar("ring", { length: 100 })'),
);
check(
  "catálogo interno usa bitolas FOB 2026",
  contains("server/_core/canarilIntelligence/breedKnowledge.ts", /code: "canario_cor"[^\n]*defaultRingGaugeMm: 3\.0/) &&
    contains("server/_core/canarilIntelligence/breedKnowledge.ts", /code: "gloster_corona"[^\n]*defaultRingGaugeMm: 3\.0/) &&
    contains("server/_core/canarilIntelligence/breedKnowledge.ts", /code: "border"[^\n]*defaultRingGaugeMm: 3\.4/),
);
check("rotina diária sem leitura global de logs", contains("server/routers/dailyCare.ts", "inArray(breeding_daily_logs.coupleId, coupleIds)"));

for (const name of passes) console.log(`PASS  ${name}`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL  ${failure}`);
  console.error(`\n${failures.length} verificação(ões) falharam.`);
  process.exit(1);
}
console.log(`\n${passes.length} verificações de hardening aprovadas.`);
