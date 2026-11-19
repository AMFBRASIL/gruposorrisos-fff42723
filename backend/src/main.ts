import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: resolve(backendRoot, ".env") });

const { loadEnv: readEnv } = await import("./config/env.js");
const { createPool } = await import("./database/pool.js");
const { buildApp, prepareDatabase } = await import("./app.js");

const env = readEnv();
const pool = createPool(env);
const app = await buildApp(env, pool);

try {
  await prepareDatabase(env, pool, (message) => app.log.info(message));
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  await pool.end().catch(() => undefined);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.close().catch(() => process.exit(1));
  });
}
