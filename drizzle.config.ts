import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  // Use the PostgreSQL dialect instead of MySQL. This ensures drizzle-kit
  // generates the correct SQL and type mappings for a PostgreSQL database.
  dialect: "postgresql",
  dbCredentials: {
    // drizzle-kit expects `connectionString` for postgres rather than `url`.
    connectionString,
  },
});
