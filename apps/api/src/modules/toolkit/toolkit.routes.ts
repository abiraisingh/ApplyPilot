import { Router } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import { assertCsrf } from "../auth/auth.controller.js";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  createPrep,
  atsScoreResume,
  downloadResume,
  insights,
  interviewPrepChat,
  listPreps,
  listResumeFiles,
  removePrep,
  removeResume,
  updatePrep,
  updateResume,
  uploadResume,
} from "./toolkit.controller.js";

export const toolkitRoutes = Router();
toolkitRoutes.use(requireAuth);
const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
toolkitRoutes.get("/resumes", listResumeFiles);
toolkitRoutes.post("/resumes", (req, _res, next) => {
  try { assertCsrf(req); next(); } catch (error) { next(error); }
}, express.raw({
  type: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  limit: "5mb",
}), uploadResume);
toolkitRoutes.patch("/resumes/:id", (req, _res, next) => {
  try { assertCsrf(req); next(); } catch (error) { next(error); }
}, updateResume);
toolkitRoutes.post("/resumes/:id/ats-score", aiRateLimit, (req, _res, next) => {
  try { assertCsrf(req); next(); } catch (error) { next(error); }
}, atsScoreResume);
toolkitRoutes.get("/resumes/:id/download", downloadResume);
toolkitRoutes.delete("/resumes/:id", (req, _res, next) => {
  try { assertCsrf(req); next(); } catch (error) { next(error); }
}, removeResume);

toolkitRoutes.get("/interview-preps", listPreps);
toolkitRoutes.post("/interview-preps", (req, _res, next) => {
  try { assertCsrf(req); next(); } catch (error) { next(error); }
}, createPrep);
toolkitRoutes.patch("/interview-preps/:id", (req, _res, next) => {
  try { assertCsrf(req); next(); } catch (error) { next(error); }
}, updatePrep);
toolkitRoutes.post("/interview-preps/:id/chat", aiRateLimit, (req, _res, next) => {
  try { assertCsrf(req); next(); } catch (error) { next(error); }
}, interviewPrepChat);
toolkitRoutes.delete("/interview-preps/:id", (req, _res, next) => {
  try { assertCsrf(req); next(); } catch (error) { next(error); }
}, removePrep);
toolkitRoutes.get("/insights", insights);
