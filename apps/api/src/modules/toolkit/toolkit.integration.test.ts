import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../config/env.js";
import { app } from "../../app.js";
import { prisma } from "../../shared/prisma.js";

type TestUser = { agent: ReturnType<typeof request.agent>; csrf: string };

function textPdf(text: string) {
  const escapedText = text.replace(/([\\()])/g, "\\$1");
  const stream = `BT\n/F1 12 Tf\n40 650 Td\n(${escapedText}) Tj\nET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 2000 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(document));
    document += object;
  }
  const xrefOffset = Buffer.byteLength(document);
  document += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document);
}

async function createUser(email: string): Promise<TestUser> {
  const agent = request.agent(app);
  const csrf = (await agent.get("/api/v1/auth/csrf").expect(200)).body.data.csrfToken as string;
  await agent.post("/api/v1/auth/register")
    .set("X-CSRF-Token", csrf)
    .send({ name: "Toolkit User", email, password: "a-secure-password" })
    .expect(201);
  return { agent, csrf };
}

describe("toolkit API", () => {
  beforeEach(async () => {
    await prisma.interviewPrep.deleteMany();
    await prisma.resumeDocument.deleteMany();
    await prisma.applicationEvent.deleteMany();
    await prisma.application.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stores, lists, downloads, and deletes private resume files", async () => {
    const owner = await createUser("resume-owner@example.test");
    const other = await createUser("resume-other@example.test");
    const content = Buffer.from("%PDF-1.7\nprivate resume content");
    const upload = (agent: TestUser, filename: string, description = "") => agent.agent.post("/api/v1/toolkit/resumes")
      .set("X-CSRF-Token", agent.csrf)
      .set("Content-Type", "application/pdf")
      .set("X-File-Name", encodeURIComponent(filename))
      .set("X-Resume-Description", encodeURIComponent(description))
      .send(content);

    await request(app).get("/api/v1/toolkit/resumes").expect(401);
    await owner.agent.post("/api/v1/toolkit/resumes")
      .set("Content-Type", "application/pdf")
      .set("X-File-Name", "resume.pdf")
      .send(content)
      .expect(403);
    await owner.agent.post("/api/v1/toolkit/resumes")
      .set("X-CSRF-Token", owner.csrf)
      .set("Content-Type", "application/pdf")
      .set("X-File-Name", "fake.pdf")
      .send(Buffer.from("not a PDF"))
      .expect(400);

    const uploaded = await upload(owner, "Candidate Resume.pdf", "Senior product designer roles").expect(201);
    const id = uploaded.body.data.id as string;
    expect(uploaded.body.data).toMatchObject({
      name: "Candidate Resume.pdf",
      description: "Senior product designer roles",
      contentType: "application/pdf",
      size: content.length,
    });
    expect((await owner.agent.get("/api/v1/toolkit/resumes").expect(200)).body.data).toHaveLength(1);
    const updatedResume = await owner.agent.patch(`/api/v1/toolkit/resumes/${id}`)
      .set("X-CSRF-Token", owner.csrf)
      .send({ description: "Product design leadership" })
      .expect(200);
    expect(updatedResume.body.data.description).toBe("Product design leadership");
    expect((await other.agent.get("/api/v1/toolkit/resumes").expect(200)).body.data).toHaveLength(0);
    await other.agent.get(`/api/v1/toolkit/resumes/${id}/download`).expect(404);
    await other.agent.post(`/api/v1/toolkit/resumes/${id}/ats-score`)
      .set("X-CSRF-Token", other.csrf)
      .send({})
      .expect(404);
    await owner.agent.get(`/api/v1/toolkit/resumes/${id}/download`)
      .expect(200)
      .expect("Content-Type", "application/pdf")
      .expect((response) => expect(response.body.toString()).toBe(content.toString()));
    await other.agent.delete(`/api/v1/toolkit/resumes/${id}`)
      .set("X-CSRF-Token", other.csrf)
      .expect(404);
    await owner.agent.delete(`/api/v1/toolkit/resumes/${id}`)
      .set("X-CSRF-Token", owner.csrf)
      .expect(204);
    expect(await prisma.resumeDocument.count()).toBe(0);
  });

  it("persists interview preparation and restricts linked applications to their owner", async () => {
    const owner = await createUser("prep-owner@example.test");
    const other = await createUser("prep-other@example.test");
    const application = await owner.agent.post("/api/v1/applications")
      .set("X-CSRF-Token", owner.csrf)
      .send({ companyName: "Northstar", role: "Designer", status: "INTERVIEW", jobDescription: "Lead product discovery and prototyping." })
      .expect(201);
    const applicationId = application.body.data.id as string;
    const applicationList = await owner.agent.get("/api/v1/applications").expect(200);
    expect(applicationList.body.data.items[0].jobDescription).toBe("Lead product discovery and prototyping.");

    await owner.agent.post("/api/v1/toolkit/interview-preps")
      .send({ title: "Design exercise", applicationId, scheduledAt: null, notes: "" })
      .expect(403);
    await other.agent.post("/api/v1/toolkit/interview-preps")
      .set("X-CSRF-Token", other.csrf)
      .send({ title: "Design exercise", applicationId, scheduledAt: null, notes: "" })
      .expect(404);
    const created = await owner.agent.post("/api/v1/toolkit/interview-preps")
      .set("X-CSRF-Token", owner.csrf)
      .send({
        title: "Design exercise",
        applicationId,
        scheduledAt: "2026-11-02T10:00:00.000Z",
        notes: "Review the portfolio case study",
      })
      .expect(201);
    const prepId = created.body.data.id as string;
    expect(created.body.data.application).toMatchObject({ companyName: "Northstar", role: "Designer" });
    expect((await owner.agent.get("/api/v1/toolkit/interview-preps").expect(200)).body.data).toHaveLength(1);
    expect((await other.agent.get("/api/v1/toolkit/interview-preps").expect(200)).body.data).toHaveLength(0);
    await other.agent.post(`/api/v1/toolkit/interview-preps/${prepId}/chat`)
      .set("X-CSRF-Token", other.csrf)
      .send({ messages: [{ role: "user", content: "Help me prepare." }] })
      .expect(404);

    const updated = await owner.agent.patch(`/api/v1/toolkit/interview-preps/${prepId}`)
      .set("X-CSRF-Token", owner.csrf)
      .send({ notes: "Practice the presentation" })
      .expect(200);
    expect(updated.body.data.notes).toBe("Practice the presentation");
    await other.agent.delete(`/api/v1/toolkit/interview-preps/${prepId}`)
      .set("X-CSRF-Token", other.csrf)
      .expect(404);

    const insights = await owner.agent.get("/api/v1/toolkit/insights").expect(200);
    expect(insights.body.data.totals).toMatchObject({
      total: 1,
      interviewed: 1,
      interviewRate: 100,
    });
    expect(insights.body.data.monthlyApplications).toHaveLength(6);
  });

  it("extracts a resume and returns validated ATS guidance from the configured provider", async () => {
    const owner = await createUser("resume-score@example.test");
    const resumeText = "Candidate Alex Morgan. Senior product designer with eight years of experience. Led user research, accessibility improvements, product strategy, and measurable conversion growth.";
    const pdf = textPdf(resumeText);
    const uploaded = await owner.agent.post("/api/v1/toolkit/resumes")
      .set("X-CSRF-Token", owner.csrf)
      .set("Content-Type", "application/pdf")
      .set("X-File-Name", "designer-resume.pdf")
      .send(pdf)
      .expect(201);
    const application = await owner.agent.post("/api/v1/applications")
      .set("X-CSRF-Token", owner.csrf)
      .send({ companyName: "Northstar", role: "Senior Product Designer", jobDescription: "Lead product design, user research, accessibility, and cross-functional strategy." })
      .expect(201);
    const originalConfig = { baseUrl: env.AI_BASE_URL, apiKey: env.AI_API_KEY, model: env.AI_MODEL };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            score: 82,
            summary: "Strong alignment with the target role.",
            strengths: ["Relevant design experience"],
            improvements: ["Add specific outcome metrics"],
            missingKeywords: ["Design systems"],
          }),
        },
      }],
    }), { status: 200 }));
    try {
      env.AI_BASE_URL = "https://ai.example/v1";
      env.AI_API_KEY = "test-key";
      env.AI_MODEL = "test-model";
      vi.stubGlobal("fetch", fetchMock);
      const response = await owner.agent.post(`/api/v1/toolkit/resumes/${uploaded.body.data.id}/ats-score`)
        .set("X-CSRF-Token", owner.csrf)
        .send({ applicationId: application.body.data.id })
        .expect(200);
      expect(response.body.data).toMatchObject({
        score: 82,
        missingKeywords: ["Design systems"],
      });
      const providerRequest = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
      expect(providerRequest.messages[1].content).toContain(resumeText);
      expect(providerRequest.messages[1].content).toContain("Lead product design");
    } finally {
      env.AI_BASE_URL = originalConfig.baseUrl;
      env.AI_API_KEY = originalConfig.apiKey;
      env.AI_MODEL = originalConfig.model;
      vi.unstubAllGlobals();
    }
  });
});
