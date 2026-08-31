import { Router } from "express";
import { clientIp, paramId } from "../lib/http.js";
import { createUserBody, listQuery, updateUserBody } from "../lib/schemas.js";
import { requireAdmin, requireStaff } from "../middleware/auth.js";
import { asyncHandler, parseOrThrow, validateBody } from "../middleware/validate.js";
import * as users from "../services/user-service.js";

export const usersRouter = Router();

usersRouter.get(
  "/",
  requireStaff,
  asyncHandler(async (req, res) => {
    const query = parseOrThrow(listQuery, req.query);
    res.json(await users.listUsers(query));
  }),
);

usersRouter.post(
  "/",
  requireAdmin,
  validateBody(createUserBody),
  asyncHandler(async (req, res) => {
    const created = await users.createUser(req.body, req.auth!.userId, clientIp(req));
    res.status(201).json({ user: created });
  }),
);

usersRouter.get(
  "/:id",
  requireStaff,
  asyncHandler(async (req, res) => {
    res.json({ user: await users.getUser(paramId(req.params.id)) });
  }),
);

usersRouter.patch(
  "/:id",
  requireAdmin,
  validateBody(updateUserBody),
  asyncHandler(async (req, res) => {
    const updated = await users.updateUser(paramId(req.params.id), req.body, req.auth!.userId, clientIp(req));
    res.json({ user: updated });
  }),
);
