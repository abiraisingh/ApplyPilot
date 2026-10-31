import { z } from "zod";

export const statusSchema = z.enum([
  "SAVED",
  "APPLIED",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
]);

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalDate = z.iso.datetime().nullable().optional().transform((value) =>
  value == null ? value : new Date(value),
);

export const createApplicationSchema = z.object({
  companyName: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(160),
  jobUrl: z.union([z.string().trim().url().max(2048), z.literal("")]).nullable().optional(),
  jobDescription: optionalText(20000),
  location: optionalText(160),
  salaryMin: z.number().int().min(0).nullable().optional(),
  salaryMax: z.number().int().min(0).nullable().optional(),
  appliedAt: optionalDate,
  status: statusSchema.default("SAVED"),
  notes: optionalText(10000),
  priority: z.number().int().min(0).max(3).default(0),
  nextAction: optionalText(500),
  followUpAt: optionalDate,
}).refine(
  (value) => value.salaryMin == null || value.salaryMax == null || value.salaryMin <= value.salaryMax,
  { message: "Minimum salary must not exceed maximum salary", path: ["salaryMin"] },
);

export const updateApplicationSchema = z.object({
  companyName: z.string().trim().min(1).max(120).optional(),
  role: z.string().trim().min(1).max(160).optional(),
  jobUrl: z.union([z.string().trim().url().max(2048), z.literal("")]).nullable().optional(),
  jobDescription: optionalText(20000),
  location: optionalText(160),
  salaryMin: z.number().int().min(0).nullable().optional(),
  salaryMax: z.number().int().min(0).nullable().optional(),
  appliedAt: optionalDate,
  notes: optionalText(10000),
  priority: z.number().int().min(0).max(3).optional(),
  nextAction: optionalText(500),
  followUpAt: optionalDate,
}).refine((value) => Object.keys(value).length > 0, {
  message: "Provide at least one field to update",
}).refine(
  (value) => value.salaryMin == null || value.salaryMax == null || value.salaryMin <= value.salaryMax,
  { message: "Minimum salary must not exceed maximum salary", path: ["salaryMin"] },
);

export const changeStatusSchema = z.object({
  status: statusSchema,
  note: z.string().trim().max(1000).nullable().optional(),
});

export const captureApplicationSchema = z.object({
  companyName: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(160),
  jobUrl: z.string().trim().url().max(2048),
  location: optionalText(160),
  status: statusSchema.default("APPLIED"),
});

export const applicationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: statusSchema.optional(),
  q: z.string().trim().max(120).optional(),
  sort: z.enum(["updatedAt", "createdAt", "companyName", "role"]).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
