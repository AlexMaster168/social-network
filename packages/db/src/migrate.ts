import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// .env лежит в корне монорепо
config({ path: "../../.env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL не задан. Пропиши его в .env в корне проекта.");
}

const migrationClient = postgres(connectionString, { max: 1 });

async function main() {
  console.log("⏳ Применяю миграции...");
  await migrate(drizzle(migrationClient), { migrationsFolder: "./drizzle" });
  console.log("✅ Миграции применены.");
  await migrationClient.end();
}

main().catch((err) => {
  console.error("❌ Ошибка миграции:", err);
  process.exit(1);
});
