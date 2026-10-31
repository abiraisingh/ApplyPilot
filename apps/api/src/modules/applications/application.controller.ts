import { ApplicationStatus, Prisma } from "../../../generated/prisma/client.js";
import type { Request } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { HttpError } from "../../shared/errors.js";
import {
  applicationQuerySchema,
  captureApplicationSchema,
  changeStatusSchema,
  createApplicationSchema,
  updateApplicationSchema,
} from "./application.schemas.js";
import {
  createApplication,
  captureApplication,
  deleteApplication,
  getApplication,
  getDashboard,
  listApplications,
  updateApplication,
  updateStatus,
} from "./application.service.js";
import { importJobDetails } from "./job-import.service.js";

function userIdOf(req: Request): string {
  if (!req.userId) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue");
  return req.userId;
}

const idSchema = z.string().uuid();

export const list = asyncHandler(async (req, res) => {
  const options = applicationQuerySchema.parse(req.query);
  const result = await listApplications(userIdOf(req), options as {
    page: number;
    pageSize: number;
    status?: ApplicationStatus;
    q?: string;
    sort: "updatedAt" | "createdAt" | "companyName" | "role";
    order: "asc" | "desc";
  });
  res.json({ data: result });
});

export const create = asyncHandler(async (req, res) => {
  const input = createApplicationSchema.parse(req.body);
  const data = await createApplication(userIdOf(req), input as Prisma.ApplicationUncheckedCreateInput);
  res.status(201).json({ data });
});

export const importJob = asyncHandler(async (req, res) => {
  const input = z.object({ url: z.string().trim().min(1).max(2048) }).parse(req.body);
  const data = await importJobDetails(input.url);
  res.json({ data });
});

export const capture = asyncHandler(async (req, res) => {
  const input = captureApplicationSchema.parse(req.body);
  const data = await captureApplication(userIdOf(req), input);
  res.status(201).json({ data });
});

export const getById = asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const data = await getApplication(userIdOf(req), id);
  res.json({ data });
});

export const update = asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const input = updateApplicationSchema.parse(req.body);
  const data = await updateApplication(userIdOf(req), id, input as Prisma.ApplicationUpdateInput);
  res.json({ data });
});

export const changeStatus = asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const input = changeStatusSchema.parse(req.body);
  const data = await updateStatus(userIdOf(req), id, input.status, input.note);
  res.json({ data });
});

export const remove = asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.id);
  await deleteApplication(userIdOf(req), id);
  res.status(204).end();
});

export const dashboard = asyncHandler(async (req, res) => {
  const data = await getDashboard(userIdOf(req));
  res.json({ data });
});
