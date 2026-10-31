import type { Request } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { HttpError } from "../../shared/errors.js";
import {
  createInterviewPrep,
  answerInterviewPrepQuestion,
  deleteInterviewPrep,
  deleteResume,
  getInsights,
  getResume,
  listInterviewPreps,
  listResumes,
  saveResume,
  scoreResume,
  updateResumeDescription,
  updateInterviewPrep,
} from "./toolkit.service.js";

const idSchema = z.string().uuid();
const prepFields = {
  title: z.string().trim().min(1).max(160),
  applicationId: z.string().uuid().nullable(),
  scheduledAt: z.string().datetime({ offset: true }).nullable(),
  notes: z.string().max(10000),
};
const createPrepSchema = z.object(prepFields);
const updatePrepSchema = z.object(prepFields).partial().refine(
  (value) => Object.keys(value).length > 0,
  "Provide at least one field to update",
);
const updateResumeSchema = z.object({
  description: z.string().trim().max(500),
});
const scoreResumeSchema = z.object({
  applicationId: z.string().uuid().optional(),
});
const interviewChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(2000),
  })).min(1).max(10).refine((messages) => messages.at(-1)?.role === "user"),
});

function userIdOf(req: Request): string {
  if (!req.userId) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue");
  return req.userId;
}

export const listResumeFiles = asyncHandler(async (req, res) => {
  res.json({ data: await listResumes(userIdOf(req)) });
});

export const uploadResume = asyncHandler(async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new HttpError(400, "INVALID_RESUME", "Choose a non-empty PDF or DOCX file");
  }
  const contentType = req.get("Content-Type") ?? "";
  const encodedName = req.get("X-File-Name");
  if (!encodedName) throw new HttpError(400, "INVALID_RESUME", "Resume file name is required");
  let name: string;
  try {
    name = decodeURIComponent(encodedName).trim();
  } catch {
    throw new HttpError(400, "INVALID_RESUME", "Resume file name is invalid");
  }
  if (!name || name.length > 180 || /[\\/\u0000-\u001f]/.test(name)) {
    throw new HttpError(400, "INVALID_RESUME", "Resume file name is invalid");
  }
  const encodedDescription = req.get("X-Resume-Description") ?? "";
  let description: string;
  try {
    description = decodeURIComponent(encodedDescription).trim();
  } catch {
    throw new HttpError(400, "INVALID_RESUME", "Resume description is invalid");
  }
  if (description.length > 500) {
    throw new HttpError(400, "INVALID_RESUME", "Resume description must be 500 characters or fewer");
  }
  const extension = name.toLowerCase().split(".").pop();
  const isPdf = contentType === "application/pdf" && extension === "pdf" &&
    req.body.subarray(0, 5).toString("ascii") === "%PDF-";
  const isDocx = contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
    extension === "docx" && req.body.length > 4 &&
    req.body[0] === 0x50 && req.body[1] === 0x4b && req.body[2] === 0x03 && req.body[3] === 0x04;
  if (!isPdf && !isDocx) {
    throw new HttpError(400, "INVALID_RESUME", "File must be a valid PDF or DOCX resume");
  }
  if (req.body.length > 5 * 1024 * 1024) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Resume files must be 5 MB or smaller");
  }
  const data = await saveResume(userIdOf(req), { name, description, contentType, content: req.body });
  res.status(201).json({ data });
});

export const updateResume = asyncHandler(async (req, res) => {
  const input = updateResumeSchema.parse(req.body);
  const data = await updateResumeDescription(userIdOf(req), idSchema.parse(req.params.id), input.description);
  res.json({ data });
});

export const atsScoreResume = asyncHandler(async (req, res) => {
  const input = scoreResumeSchema.parse(req.body);
  const data = await scoreResume(userIdOf(req), idSchema.parse(req.params.id), input.applicationId);
  res.json({ data });
});

export const downloadResume = asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const resume = await getResume(userIdOf(req), id);
  res.setHeader("Content-Type", resume.contentType);
  res.setHeader("Content-Length", resume.size);
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(resume.name)}`);
  res.send(Buffer.from(resume.content));
});

export const removeResume = asyncHandler(async (req, res) => {
  await deleteResume(userIdOf(req), idSchema.parse(req.params.id));
  res.status(204).end();
});

export const listPreps = asyncHandler(async (req, res) => {
  res.json({ data: await listInterviewPreps(userIdOf(req)) });
});

export const createPrep = asyncHandler(async (req, res) => {
  const input = createPrepSchema.parse(req.body);
  const data = await createInterviewPrep(userIdOf(req), {
    ...input,
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
  });
  res.status(201).json({ data });
});

export const updatePrep = asyncHandler(async (req, res) => {
  const input = updatePrepSchema.parse(req.body);
  const { scheduledAt, ...fields } = input;
  const data = await updateInterviewPrep(userIdOf(req), idSchema.parse(req.params.id), {
    ...fields,
    ...(scheduledAt !== undefined
      ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }
      : {}),
  });
  res.json({ data });
});

export const removePrep = asyncHandler(async (req, res) => {
  await deleteInterviewPrep(userIdOf(req), idSchema.parse(req.params.id));
  res.status(204).end();
});

export const interviewPrepChat = asyncHandler(async (req, res) => {
  const input = interviewChatSchema.parse(req.body);
  const data = await answerInterviewPrepQuestion(userIdOf(req), idSchema.parse(req.params.id), input.messages);
  res.json({ data });
});

export const insights = asyncHandler(async (req, res) => {
  res.json({ data: await getInsights(userIdOf(req)) });
});
