import { Router } from "express";
import { clientIp, paramId } from "../lib/http.js";
import { reviewBody, saveResponseBody, staffAssessmentQuery, startAssessmentBody } from "../lib/schemas.js";
import { requireStaff } from "../middleware/auth.js";
import { asyncHandler, parseOrThrow, validateBody } from "../middleware/validate.js";
import * as assessments from "../services/assessment-service.js";

export const assessmentsRouter = Router();

assessmentsRouter.get(
  "/catalog",
  asyncHandler(async (req, res) => {
    res.json(await assessments.catalogForUser(req.auth!));
  }),
);

assessmentsRouter.post(
  "/start",
  validateBody(startAssessmentBody),
  asyncHandler(async (req, res) => {
    const body = req.body as { toolCode: string };
    res.status(201).json(await assessments.startAssessment(req.auth!, body.toolCode, clientIp(req)));
  }),
);

assessmentsRouter.get(
  "/",
  requireStaff,
  asyncHandler(async (req, res) => {
    const query = parseOrThrow(staffAssessmentQuery, req.query);
    res.json(await assessments.listStaffAssessments(query));
  }),
);

assessmentsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await assessments.getAssessment(req.auth!, paramId(req.params.id)));
  }),
);

assessmentsRouter.put(
  "/:id/responses",
  validateBody(saveResponseBody),
  asyncHandler(async (req, res) => {
    const body = req.body as { questionId: string; optionId?: string | null; freeText?: string | null };
    res.json(await assessments.saveResponse(req.auth!, paramId(req.params.id), body));
  }),
);

assessmentsRouter.post(
  "/:id/submit",
  asyncHandler(async (req, res) => {
    res.json(await assessments.submitAssessment(req.auth!, paramId(req.params.id), clientIp(req)));
  }),
);

assessmentsRouter.patch(
  "/:id/review",
  requireStaff,
  validateBody(reviewBody),
  asyncHandler(async (req, res) => {
    const body = req.body as { notes?: string; status: "PENDING" | "IN_REVIEW" | "COMPLETED" };
    res.json(await assessments.reviewAssessment(req.auth!, paramId(req.params.id), body, clientIp(req)));
  }),
);
