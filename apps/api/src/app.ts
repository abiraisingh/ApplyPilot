import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { applicationRoutes } from "./modules/applications/application.routes.js";
import { requireAuth } from "./modules/auth/auth.middleware.js";
import { dashboard } from "./modules/applications/application.controller.js";
import { gmailRoutes } from "./modules/integrations/gmail.routes.js";
import { toolkitRoutes } from "./modules/toolkit/toolkit.routes.js";
import { errorHandler } from "./shared/errors.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/integrations/gmail", gmailRoutes);
app.use("/api/v1/applications", applicationRoutes);
app.use("/api/v1/toolkit", toolkitRoutes);
app.get("/api/v1/dashboard", requireAuth, dashboard);
app.use((_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});
app.use(errorHandler);
