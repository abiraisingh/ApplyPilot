import type { Request, RequestHandler, Response } from "express";

type AsyncController = (req: Request, res: Response) => Promise<void>;

export const asyncHandler = (controller: AsyncController): RequestHandler =>
  (req, res, next) => {
    void controller(req, res).catch(next);
  };
