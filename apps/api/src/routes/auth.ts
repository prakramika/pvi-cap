import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { clientIp } from "../lib/http.js";
import {
  forgotPasswordBody,
  loginBody,
  logoutBody,
  refreshBody,
  resetPasswordBody,
} from "../lib/schemas.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, validateBody } from "../middleware/validate.js";
import * as auth from "../services/auth-service.js";

export const authRouter = Router();

const authWindow = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.nodeEnv === "test",
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts. Try again in 15 minutes." } },
});

authRouter.post(
  "/login",
  authWindow,
  validateBody(loginBody),
  asyncHandler(async (req, res) => {
    const body = req.body as { email: string; password: string };
    const result = await auth.login({ ...body, ip: clientIp(req) });
    res.json(result);
  }),
);

authRouter.post(
  "/refresh",
  validateBody(refreshBody),
  asyncHandler(async (req, res) => {
    const body = req.body as { refreshToken: string };
    res.json(await auth.refreshSession(body.refreshToken));
  }),
);

authRouter.post(
  "/logout",
  requireAuth,
  validateBody(logoutBody),
  asyncHandler(async (req, res) => {
    const body = req.body as { refreshToken: string };
    await auth.logout(req.auth!.userId, body.refreshToken, clientIp(req));
    res.status(204).end();
  }),
);

authRouter.post(
  "/forgot-password",
  authWindow,
  validateBody(forgotPasswordBody),
  asyncHandler(async (req, res) => {
    const body = req.body as { email: string };
    await auth.requestPasswordReset(body.email);
    res.json({ ok: true });
  }),
);

authRouter.post(
  "/reset-password",
  authWindow,
  validateBody(resetPasswordBody),
  asyncHandler(async (req, res) => {
    const body = req.body as { email: string; code: string; password: string };
    await auth.resetPassword({ ...body, ip: clientIp(req) });
    res.json({ ok: true });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: await auth.getMe(req.auth!.userId) });
  }),
);
