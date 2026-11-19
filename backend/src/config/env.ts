import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3333),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  BOOTSTRAP_ADMIN_NAME: z.string().min(1).default("Administrador"),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().default("admin@gruposorrisos.com.br"),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(8).optional(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".") || "env").join(", ");
    throw new Error(`Variáveis de ambiente inválidas: ${fields}. Confira backend/.env.`);
  }
  return parsed.data;
}
