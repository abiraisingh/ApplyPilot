import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "./auth.middleware.js";
import { csrf, login, logout, me, register } from "./auth.controller.js";

export const authRoutes = Router();
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

authRoutes.get("/csrf", csrf);
authRoutes.post("/register", authRateLimit, register);
authRoutes.post("/login", authRateLimit, login);
authRoutes.post("/logout", requireAuth, logout);
authRoutes.get("/me", requireAuth, me);
