import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

// Next can bundle this module once per route. The process-wide slot keeps
// those copies on the same database, including the local PGlite instance.
const slot = globalThis as typeof globalThis & {
  __snaplistPool?: pg.Pool;
  __snaplistLocal?: Promise<PGlite>;
};

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl !== "") {
    slot.__snaplistPool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return (await slot.__snaplistPool.query(text, params)).rows as T[];
  }
  slot.__snaplistLocal ??= startLocal().catch((error: unknown) => {
    slot.__snaplistLocal = undefined;
    throw error;
  });
  return (await (await slot.__snaplistLocal).query<T>(text, params)).rows;
}

async function startLocal(): Promise<PGlite> {
  const db = new PGlite();
  const files = (await readdir("migrations").catch(() => []))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  return db;
}
