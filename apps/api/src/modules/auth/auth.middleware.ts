import type { RequestHandler } from "express";
import { authenticateRequest } from "./auth.service.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  void authenticateRequest(req)
    .then((userId) => {
      req.userId = userId;
      next();
    })
    .catch(next);
};
