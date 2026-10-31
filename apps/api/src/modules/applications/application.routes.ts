import { Router } from "express";
import rateLimit from "express-rate-limit";
import { assertCsrf } from "../auth/auth.controller.js";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  changeStatus,
  capture,
  create,
  dashboard,
  getById,
  importJob,
  list,
  remove,
  update,
} from "./application.controller.js";

export const applicationRoutes = Router();
const jobImportRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
applicationRoutes.use(requireAuth);
applicationRoutes.get("/", list);
applicationRoutes.post("/import", jobImportRateLimit, (req, _res, next) => {
  try { assertCsrf(req); next(); } catch (error) { next(error); }
}, importJob);
applicationRoutes.post("/capture", (req, _res, next) => {
  try { assertCsrf(req); next(); } catch (error) { next(error); }
}, capture);
applicationRoutes.post("/", (req, _res, next) => {
  try { assertCsrf(req); next(); } catch (error) { next(error); }
}, create);
applicationRoutes.get("/:id", getById);
applicationRoutes.patch("/:id", (req, _res, next) => {
  try { assertCsrf(req); next(); } catch (error) { next(error); }
}, update);
applicationRoutes.patch("/:id/status", (req, _res, next) => {
  try { assertCsrf(req); next(); } catch (error) { next(error); }
}, changeStatus);
applicationRoutes.delete("/:id", (req, _res, next) => {
  try { assertCsrf(req); next(); } catch (error) { next(error); }
}, remove);
