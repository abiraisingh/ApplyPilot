import { ApplicationStatus, Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../shared/errors.js";
import { prisma } from "../../shared/prisma.js";

const applicationInclude = {
  events: { orderBy: { createdAt: "desc" as const } },
};

export async function listApplications(
  userId: string,
  options: {
    page: number;
    pageSize: number;
    status?: ApplicationStatus;
    q?: string;
    sort: "updatedAt" | "createdAt" | "companyName" | "role";
    order: "asc" | "desc";
  },
) {
  const where: Prisma.ApplicationWhereInput = {
    userId,
    ...(options.status ? { status: options.status } : {}),
    ...(options.q
      ? {
          OR: [
            { companyName: { contains: options.q } },
            { role: { contains: options.q } },
            { location: { contains: options.q } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.application.findMany({
      where,
      include: applicationInclude,
      orderBy: { [options.sort]: options.order },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    prisma.application.count({ where }),
  ]);
  return {
    items,
    pagination: {
      page: options.page,
      pageSize: options.pageSize,
      total,
      totalPages: Math.ceil(total / options.pageSize),
    },
  };
}

export async function getApplication(userId: string, id: string) {
  const application = await prisma.application.findFirst({
    where: { id, userId },
    include: applicationInclude,
  });
  if (!application) throw new HttpError(404, "NOT_FOUND", "Application not found");
  return application;
}

export async function createApplication(
  userId: string,
  input: Omit<Prisma.ApplicationUncheckedCreateInput, "userId">,
) {
  return prisma.$transaction(async (tx) => {
    const application = await tx.application.create({
      data: { ...input, userId },
    });
    await tx.applicationEvent.create({
      data: {
        applicationId: application.id,
        toStatus: application.status,
        note: "Application created",
      },
    });
    return tx.application.findUniqueOrThrow({
      where: { id: application.id },
      include: applicationInclude,
    });
  });
}

export async function captureApplication(
  userId: string,
  input: {
    companyName: string;
    role: string;
    jobUrl: string;
    location?: string | null;
    status: ApplicationStatus;
  },
) {
  const existing = await prisma.application.findFirst({
    where: { userId, jobUrl: input.jobUrl },
  });
  if (!existing) {
    return createApplication(userId, {
      ...input,
      source: "PORTAL_CAPTURE",
      appliedAt: input.status === "APPLIED" ? new Date() : null,
    });
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id: existing.id },
      data: {
        companyName: input.companyName,
        role: input.role,
        location: input.location ?? null,
      },
    });
    if (existing.status !== input.status) {
      await tx.application.update({ where: { id: existing.id }, data: { status: input.status } });
      await tx.applicationEvent.create({
        data: {
          applicationId: existing.id,
          fromStatus: existing.status,
          toStatus: input.status,
          note: "Status captured from a job portal page",
        },
      });
    }
    return tx.application.findUniqueOrThrow({
      where: { id: updated.id },
      include: applicationInclude,
    });
  });
}

export async function updateApplication(
  userId: string,
  id: string,
  input: Prisma.ApplicationUpdateInput,
) {
  const result = await prisma.application.updateMany({
    where: { id, userId },
    data: input,
  });
  if (result.count === 0) throw new HttpError(404, "NOT_FOUND", "Application not found");
  return getApplication(userId, id);
}

export async function updateStatus(
  userId: string,
  id: string,
  status: ApplicationStatus,
  note?: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const application = await tx.application.findFirst({ where: { id, userId } });
    if (!application) throw new HttpError(404, "NOT_FOUND", "Application not found");
    if (application.status !== status) {
      await tx.application.update({ where: { id }, data: { status } });
      await tx.applicationEvent.create({
        data: {
          applicationId: id,
          fromStatus: application.status,
          toStatus: status,
          ...(note ? { note } : {}),
        },
      });
    }
    return tx.application.findUniqueOrThrow({
      where: { id },
      include: applicationInclude,
    });
  });
}

export async function deleteApplication(userId: string, id: string) {
  const result = await prisma.application.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new HttpError(404, "NOT_FOUND", "Application not found");
}

export async function getDashboard(userId: string) {
  const [applications, events] = await prisma.$transaction([
    prisma.application.findMany({
      where: { userId },
      select: {
        id: true,
        companyName: true,
        role: true,
        status: true,
        createdAt: true,
        followUpAt: true,
        nextAction: true,
        events: { select: { toStatus: true } },
      },
    }),
    prisma.applicationEvent.findMany({
      where: { application: { userId } },
      include: {
        application: { select: { id: true, companyName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const statuses = Object.values(ApplicationStatus).map((status) => ({
    status,
    count: applications.filter((application) => application.status === status).length,
  }));
  const reachedInterview = applications.filter((application) =>
    application.events.some((event) => event.toStatus === "INTERVIEW" || event.toStatus === "OFFER"),
  );
  const reachedOffer = applications.filter((application) =>
    application.events.some((event) => event.toStatus === "OFFER"),
  );
  const activeStatuses: ApplicationStatus[] = ["SAVED", "APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER"];
  const now = new Date();
  const followUps = applications.filter(
    (application) =>
      application.followUpAt &&
      application.followUpAt >= now &&
      activeStatuses.includes(application.status),
  );

  return {
    totals: {
      total: applications.length,
      active: applications.filter((application) => activeStatuses.includes(application.status)).length,
      pendingAssessments: applications.filter((application) => application.status === "ASSESSMENT").length,
      upcomingFollowUps: followUps.length,
      interviewConversionRate: applications.length
        ? Math.round((reachedInterview.length / applications.length) * 100)
        : 0,
      interviewToOfferRate: reachedInterview.length
        ? Math.round((reachedOffer.length / reachedInterview.length) * 100)
        : 0,
    },
    statuses,
    upcomingFollowUps: followUps
      .sort((a, b) => a.followUpAt!.getTime() - b.followUpAt!.getTime())
      .slice(0, 5),
    recentActivity: events,
  };
}
