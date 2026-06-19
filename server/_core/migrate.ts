import fs from "node:fs";
import path from "node:path";
import type { Pool } from "pg";

const MIGRATIONS_TABLE = "_app_migrations";

/**
 * Resolve o diretório onde os arquivos .sql de migration ficam.
 *
 * Em produção, o Dockerfile copia a pasta `drizzle/migrations` para a raiz
 * do projeto dentro da imagem (WORKDIR /app), e o processo roda a partir de
 * `/app` (CMD ["node", "dist/index.js"]), então `process.cwd()` aponta para
 * `/app`. Em desenvolvimento, `process.cwd()` é a raiz do repositório. Os
 * dois casos resolvem para o mesmo caminho relativo.
 */
function getMigrationsDir(): string {
  return path.join(process.cwd(), "drizzle", "migrations");
}

/**
 * Executa todas as migrations pendentes em `drizzle/migrations/*.sql`, em
 * ordem alfabética, registrando cada uma como aplicada em uma tabela de
 * controle (`_app_migrations`) para que nunca seja reexecutada.
 *
 * Cada arquivo roda dentro de sua própria transação (BEGIN/COMMIT). Se uma
 * migration falhar, a transação é desfeita (ROLLBACK) e um erro é lançado —
 * isso interrompe a inicialização do servidor de propósito, para que a
 * falha apareça de forma clara nos logs de deploy (Coolify) em vez de o
 * servidor subir silenciosamente com o banco em estado inconsistente.
 */
export async function runMigrations(pool: Pool): Promise<void> {
  const dir = getMigrationsDir();

  if (!fs.existsSync(dir)) {
    console.warn(`[Migrations] Diretório não encontrado (${dir}) — nenhuma migration para aplicar.`);
    return;
  }

  const files = fs
    .readdirSync(dir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.warn(`[Migrations] Nenhum arquivo .sql encontrado em ${dir}.`);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL UNIQUE,
        "applied_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const { rows } = await client.query<{ name: string }>(
      `SELECT "name" FROM "${MIGRATIONS_TABLE}"`
    );
    const applied = new Set(rows.map(r => r.name));

    let appliedCount = 0;

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = fs.readFileSync(path.join(dir, file), "utf-8");
      console.log(`[Migrations] Aplicando ${file}...`);

      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(`INSERT INTO "${MIGRATIONS_TABLE}" ("name") VALUES ($1)`, [file]);
        await client.query("COMMIT");
        console.log(`[Migrations] ${file} aplicada com sucesso.`);
        appliedCount++;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error(`[Migrations] FALHA ao aplicar ${file}:`, error);
        throw new Error(
          `Falha ao aplicar migration "${file}": ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (appliedCount === 0) {
      console.log(`[Migrations] Banco já atualizado (${files.length} migrations verificadas, nenhuma pendente).`);
    } else {
      console.log(`[Migrations] ${appliedCount} migration(s) aplicada(s) com sucesso. Total verificado: ${files.length}.`);
    }
  } finally {
    client.release();
  }
}
