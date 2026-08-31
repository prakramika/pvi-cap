import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { learnersRouter } from "./routes/learners.js";
import { usersRouter } from "./routes/users.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: "ok",
        service: "pvi-cap-api",
        phase: "1",
        milestone: "M2",
      });
    } catch {
      res.status(503).json({ status: "degraded", database: "unreachable" });
    }
  });

  app.get("/api/v1/meta", async (_req, res) => {
    const tools = await prisma.assessmentTool.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        code: true,
        name: true,
        indicatorCount: true,
        isStageBased: true,
      },
    });

    res.json({
      product: "PVI-CAP",
      phase: 1,
      milestone: "M2",
      tools,
      outOfScope: [
        "automated scoring",
        "in-app reports",
        "native mobile apps",
        "institutional dashboards",
        "third-party integrations other than email",
      ],
    });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/users", requireAuth, usersRouter);
  app.use("/api/v1/learners", requireAuth, learnersRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
