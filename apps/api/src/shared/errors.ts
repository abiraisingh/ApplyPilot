import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Request validation failed", details: error.issues },
    });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }

  if (
    error instanceof SyntaxError &&
    typeof error === "object" &&
    "status" in error &&
    error.status === 400 &&
    "body" in error
  ) {
    res.status(400).json({ error: { code: "MALFORMED_JSON", message: "Request body must be valid JSON" } });
    return;
  }

  if (typeof error === "object" && error !== null && "status" in error && error.status === 413) {
    res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" } });
    return;
  }

  console.error("Unhandled API error", error);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
};
