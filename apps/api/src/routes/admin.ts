import { Router } from "express";
import { clientIp, paramId } from "../lib/http.js";
import { questionImportBody, questionPatchBody, questionUpsertBody } from "../lib/schemas.js";
import { requireAdmin, requireStaff } from "../middleware/auth.js";
import { asyncHandler, validateBody } from "../middleware/validate.js";
import * as admin from "../services/admin-service.js";
import * as questions from "../services/question-service.js";

export const adminRouter = Router();

adminRouter.get(
  "/children",
  requireStaff,
  asyncHandler(async (_req, res) => {
    res.json(await admin.listChildren());
  }),
);

adminRouter.get(
  "/children/:id",
  requireStaff,
  asyncHandler(async (req, res) => {
    res.json(await admin.getChildDesk(req.auth!, paramId(req.params.id)));
  }),
);

adminRouter.get(
  "/questions",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await questions.listQuestionBank());
  }),
);

adminRouter.get(
  "/questions/template.csv",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=pvi-cap-questions.csv");
    res.send(questions.csvTemplate());
  }),
);

adminRouter.post(
  "/questions",
  requireAdmin,
  validateBody(questionUpsertBody),
  asyncHandler(async (req, res) => {
    res.status(201).json({ question: await questions.upsertQuestion(req.body, req.auth!.userId, clientIp(req)) });
  }),
);

adminRouter.post(
  "/questions/import",
  requireAdmin,
  validateBody(questionImportBody),
  asyncHandler(async (req, res) => {
    const body = req.body as { csv: string };
    res.json(await questions.importCsv(body.csv, req.auth!.userId, clientIp(req)));
  }),
);

adminRouter.patch(
  "/questions/:id",
  requireAdmin,
  validateBody(questionPatchBody),
  asyncHandler(async (req, res) => {
    res.json({
      question: await questions.updateQuestion(paramId(req.params.id), req.body, req.auth!.userId, clientIp(req)),
    });
  }),
);

adminRouter.delete(
  "/questions/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await questions.deleteQuestion(paramId(req.params.id), req.auth!.userId, clientIp(req)));
  }),
);
