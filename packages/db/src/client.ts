import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL не задан. Скопируй .env.example в .env и пропиши строку подключения к Postgres.",
  );
}

// Один пул на процесс.
const queryClient = postgres(connectionString, { max: 10 });

export const db = drizzle(queryClient, { schema });
export { schema };
export type DB = typeof db;
