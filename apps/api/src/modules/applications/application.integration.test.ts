import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../shared/prisma.js";

type TestUser = { agent: ReturnType<typeof request.agent>; csrf: string };

async function createUser(email: string): Promise<TestUser> {
  const agent = request.agent(app);
  const csrfResponse = await agent.get("/api/v1/auth/csrf").expect(200);
  const csrf = csrfResponse.body.data.csrfToken as string;
  await agent.post("/api/v1/auth/register")
    .set("X-CSRF-Token", csrf)
    .send({ name: "Test Candidate", email, password: "a-secure-password" })
    .expect(201);
  return { agent, csrf };
}

describe("first milestone API", () => {
  beforeEach(async () => {
    await prisma.applicationEvent.deleteMany();
    await prisma.application.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("requires CSRF protection and creates a persistent user session", async () => {
    const agent = request.agent(app);
    const csrf = (await agent.get("/api/v1/auth/csrf").expect(200)).body.data.csrfToken as string;
    await agent.post("/api/v1/auth/register")
      .send({ name: "Casey", email: "casey@example.test", password: "a-secure-password" })
      .expect(403);
    const response = await agent.post("/api/v1/auth/register")
      .set("X-CSRF-Token", csrf)
      .send({ name: "Casey", email: "CASEY@example.test", password: "a-secure-password" })
      .expect(201);

    expect(response.body.data.user.email).toBe("casey@example.test");
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("HttpOnly")]),
    );
    expect(await prisma.session.count()).toBe(1);
    await agent.get("/api/v1/auth/me").expect(200);
  });

  it("requires authentication and CSRF protection for public job imports", async () => {
    const agent = request.agent(app);
    await agent.post("/api/v1/applications/import")
      .send({ url: "https://example.com/jobs/engineer" })
      .expect(401);

    const { agent: signedInAgent, csrf } = await createUser("import@example.test");
    await signedInAgent.post("/api/v1/applications/import")
      .send({ url: "https://example.com/jobs/engineer" })
      .expect(403);
    await signedInAgent.post("/api/v1/applications/import")
      .set("X-CSRF-Token", csrf)
      .send({ url: "http://127.0.0.1/admin" })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("INVALID_JOB_URL"));
  });

  it("captures a portal job with an authenticated request and updates duplicate captures", async () => {
    const unauthenticated = request.agent(app);
    await unauthenticated.post("/api/v1/applications/capture")
      .send({
        companyName: "Northstar",
        role: "Designer",
        jobUrl: "https://www.linkedin.com/jobs/view/123",
      })
      .expect(401);

    const { agent, csrf } = await createUser("capture@example.test");
    const payload = {
      companyName: "Northstar",
      role: "Product Designer",
      jobUrl: "https://www.linkedin.com/jobs/view/123",
      status: "APPLIED",
    };
    await agent.post("/api/v1/applications/capture")
      .send(payload)
      .expect(403);
    const captured = await agent.post("/api/v1/applications/capture")
      .set("X-CSRF-Token", csrf)
      .send(payload)
      .expect(201);
    expect(captured.body.data.source).toBe("PORTAL_CAPTURE");
    expect(await prisma.application.count()).toBe(1);

    const updated = await agent.post("/api/v1/applications/capture")
      .set("X-CSRF-Token", csrf)
      .send({ ...payload, status: "INTERVIEW" })
      .expect(201);
    expect(updated.body.data.status).toBe("INTERVIEW");
    expect(await prisma.application.count()).toBe(1);
    expect(await prisma.applicationEvent.count()).toBe(2);
  });

  it("requires the initiating signed-in account for the Gmail OAuth callback", async () => {
    await request(app).get("/api/v1/integrations/gmail/callback?state=test&code=test").expect(401);
  });

  it("persists applications, records status history, and derives dashboard metrics", async () => {
    const { agent, csrf } = await createUser("owner@example.test");
    const created = await agent.post("/api/v1/applications")
      .set("X-CSRF-Token", csrf)
      .send({
        companyName: "Northstar",
        role: "Junior Engineer",
        location: "Bengaluru",
        status: "APPLIED",
      })
      .expect(201);
    const id = created.body.data.id as string;
    expect(created.body.data.events).toHaveLength(1);

    const updated = await agent.patch(`/api/v1/applications/${id}/status`)
      .set("X-CSRF-Token", csrf)
      .send({ status: "INTERVIEW", note: "Technical round scheduled" })
      .expect(200);
    expect(updated.body.data.events).toHaveLength(2);
    expect(updated.body.data.events[0].fromStatus).toBe("APPLIED");
    expect(updated.body.data.events[0].toStatus).toBe("INTERVIEW");

    const dashboard = await agent.get("/api/v1/dashboard").expect(200);
    expect(dashboard.body.data.totals).toMatchObject({
      total: 1,
      active: 1,
      interviewConversionRate: 100,
      interviewToOfferRate: 0,
    });

    await agent.patch(`/api/v1/applications/${id}/status`)
      .set("X-CSRF-Token", csrf)
      .send({ status: "OFFER" })
      .expect(200);
    const offerDashboard = await agent.get("/api/v1/dashboard").expect(200);
    expect(offerDashboard.body.data.totals).toMatchObject({
      active: 1,
      interviewConversionRate: 100,
      interviewToOfferRate: 100,
    });
    expect(await prisma.application.count()).toBe(1);
  });

  it("does not allow another user to read, change, or delete an application", async () => {
    const owner = await createUser("first@example.test");
    const other = await createUser("second@example.test");
    const created = await owner.agent.post("/api/v1/applications")
      .set("X-CSRF-Token", owner.csrf)
      .send({ companyName: "Private Co", role: "Engineer", status: "SAVED" })
      .expect(201);
    const id = created.body.data.id as string;

    await other.agent.get(`/api/v1/applications/${id}`).expect(404);
    await other.agent.patch(`/api/v1/applications/${id}/status`)
      .set("X-CSRF-Token", other.csrf)
      .send({ status: "OFFER" })
      .expect(404);
    await other.agent.delete(`/api/v1/applications/${id}`)
      .set("X-CSRF-Token", other.csrf)
      .expect(404);
    expect((await owner.agent.get(`/api/v1/applications/${id}`).expect(200)).body.data.status)
      .toBe("SAVED");
  });

  it("revokes the server-side session on logout", async () => {
    const { agent, csrf } = await createUser("logout@example.test");
    await agent.post("/api/v1/auth/logout").set("X-CSRF-Token", csrf).expect(204);
    await agent.get("/api/v1/auth/me").expect(401);
    expect(await prisma.session.count()).toBe(0);
  });

  it("validates application inputs and paginates results", async () => {
    const { agent, csrf } = await createUser("validate@example.test");
    await agent.post("/api/v1/applications")
      .set("X-CSRF-Token", csrf)
      .send({ companyName: "", role: "Engineer" })
      .expect(400);

    for (const companyName of ["Alpha", "Beta", "Gamma"]) {
      await agent.post("/api/v1/applications")
        .set("X-CSRF-Token", csrf)
        .send({ companyName, role: "Engineer" })
        .expect(201);
    }
    const response = await agent.get("/api/v1/applications?page=2&pageSize=2").expect(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.pagination).toMatchObject({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
  });

  it("returns client errors for malformed JSON and bcrypt-incompatible passwords", async () => {
    const agent = request.agent(app);
    const csrf = (await agent.get("/api/v1/auth/csrf").expect(200)).body.data.csrfToken as string;
    await agent.post("/api/v1/auth/register")
      .set("X-CSRF-Token", csrf)
      .set("Content-Type", "application/json")
      .send("{")
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("MALFORMED_JSON"));
    await agent.post("/api/v1/auth/register")
      .set("X-CSRF-Token", csrf)
      .send({ name: "Long Password", email: "long@example.test", password: "😀".repeat(19) })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));
    expect(await prisma.user.count()).toBe(0);
  });
});
