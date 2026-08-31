import type { Role } from "@prisma/client";
import type { RequestHandler } from "express";
import { HttpError } from "../lib/http.js";
import { verifyAccessToken } from "../lib/tokens.js";
import { prisma } from "../lib/prisma.js";

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = bearerToken(req.header("authorization"));
    if (!token) {
      throw new HttpError(401, "UNAUTHORIZED", "Sign in required.");
    }

    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch {
      throw new HttpError(401, "UNAUTHORIZED", "Session expired or invalid. Sign in again.");
    }

    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, email: true, role: true, accountStatus: true },
    });

    if (!user) {
      throw new HttpError(401, "UNAUTHORIZED", "Sign in required.");
    }
    if (user.accountStatus !== "ACTIVE") {
      throw new HttpError(403, "ACCOUNT_DISABLED", "This account is not active.");
    }

    req.auth = { userId: user.id, email: user.email, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new HttpError(401, "UNAUTHORIZED", "Sign in required."));
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(new HttpError(403, "FORBIDDEN", "You do not have access to this action."));
      return;
    }
    next();
  };
}

export const requireAdmin = requireRole("ADMIN");
export const requireStaff = requireRole("ADMIN", "EXPERT");
