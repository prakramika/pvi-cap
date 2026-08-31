import { createApp } from "./app.js";
import { env, isProd } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

if (isProd && env.jwtAccessSecret.startsWith("dev-")) {
  throw new Error("Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET before running in production.");
}

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`PVI-CAP API listening on http://localhost:${env.port}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
}

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
