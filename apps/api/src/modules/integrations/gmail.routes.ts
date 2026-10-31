import { Router } from "express";
import { assertCsrf } from "../auth/auth.controller.js";
import { requireAuth } from "../auth/auth.middleware.js";
import { connectGmail, disconnectGmail, gmailCallback, gmailStatus, syncGmail } from "./gmail.controller.js";

export const gmailRoutes = Router();

gmailRoutes.use(requireAuth);
gmailRoutes.get("/callback", gmailCallback);
gmailRoutes.get("/status", gmailStatus);
gmailRoutes.post("/connect", connectGmail);
gmailRoutes.post("/sync", syncGmail);
gmailRoutes.delete("/", (req, _res, next) => {
  try { assertCsrf(req); next(); } catch (error) { next(error); }
}, disconnectGmail);
