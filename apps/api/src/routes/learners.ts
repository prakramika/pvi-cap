import { Router } from "express";
import { HttpError, clientIp, paramId } from "../lib/http.js";
import { updateLearnerBody } from "../lib/schemas.js";
import { requireAdmin, requireAuth, requireStaff } from "../middleware/auth.js";
import { asyncHandler, validateBody } from "../middleware/validate.js";
import * as learners from "../services/learner-service.js";

export const learnersRouter = Router();

learnersRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.auth!.role !== "RESPONDENT") {
      throw new HttpError(403, "FORBIDDEN", "Only respondent accounts have a learner profile.");
    }
    res.json({ learner: await learners.getLearnerForUser(req.auth!.userId) });
  }),
);

learnersRouter.get(
  "/:id",
  requireStaff,
  asyncHandler(async (req, res) => {
    res.json({ learner: await learners.getLearnerById(paramId(req.params.id)) });
  }),
);

learnersRouter.patch(
  "/:id",
  requireAdmin,
  validateBody(updateLearnerBody),
  asyncHandler(async (req, res) => {
    const learner = await learners.updateLearner(paramId(req.params.id), req.body, req.auth!.userId, clientIp(req));
    res.json({ learner });
  }),
);
