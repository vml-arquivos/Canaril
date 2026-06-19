import { eq } from "drizzle-orm";
// Use the PostgreSQL driver for Drizzle ORM instead of the MySQL driver.  The
// postgres driver works with the `pg` client from the `pg` library.  See
// https://orm.drizzle.team/docs/guides/upsert#postgresql-and-sqlite for
// details on upsert syntax with onConflictDoUpdate.
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

// Keep a cached database instance around.  This value will be assigned once
// when first connecting to the database and reused on subsequent calls.  The
// type is defined using ReturnType<typeof drizzle> for inference.
let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the Drizzle instance backed by a PostgreSQL client.  Using a
// lazy getter avoids connecting to the database when local tooling runs
// without a real DB (e.g. unit tests or storybook).  If the connection
// attempt fails, log the error and return null so callers can handle it.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  // Require an openId to perform an upsert.  Without a unique openId we
  // can't determine the conflict target for the onConflictDoUpdate clause.
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    // Prepare the values for insertion.  We only set fields that are
    // defined on the incoming user.  Fields omitted from the object will
    // remain undefined and will not be persisted; this matches the
    // semantics of the previous implementation.
    const values: InsertUser = {
      openId: user.openId,
    };

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (values as any)[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    // Perform an upsert using PostgreSQL's ON CONFLICT DO UPDATE.  The
    // conflict target is the unique "openId" column.  If a record with the
    // same openId already exists, update the specified columns.  This
    // mirrors the previous MySQL implementation's onDuplicateKeyUpdate.
    await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.openId,
        set: {
          name: values.name,
          email: values.email,
          loginMethod: values.loginMethod,
          role: values.role,
          lastSignedIn: values.lastSignedIn,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.
