import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../../.env") });
config({ path: resolve(here, "../../.env") });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: envInt("API_PORT", 4000),
  databaseUrl: required("DATABASE_URL", "postgresql://pvi:pvi@localhost:5432/pvi_cap"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret-change-me"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me"),
  corsOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  smtp: {
    host: process.env.SMTP_HOST || "localhost",
    port: envInt("SMTP_PORT", 1025),
    secure: envBool("SMTP_SECURE", false),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || process.env.EMAIL_FROM || "noreply@localhost",
  },
  emailReplyTo: process.env.EMAIL_REPLY_TO ?? "info.prakramika@gmail.com",
  instituteUrl: process.env.INSTITUTE_URL ?? "https://prakramikavocationalinstitute.com/",
};

export const isProd = env.nodeEnv === "production";
/** SMTP_HOST unset → demo inbox on screen. localhost:1025 is Mailpit when you turn that on. */
export const fakeMail = !process.env.SMTP_HOST && !isProd;
