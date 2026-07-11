import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getConnectionToken } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { LlmService } from "../src/llm/llm.service";
import { EmailForAnalysis, EmailAnalysis } from "../src/llm/llm.types";
import { seedDemoData } from "../src/database/demo-seed";

const WEBHOOK_TOKEN = "e2e-webhook-token";
const ACME_KEY = "acme-dev-key";
const GLOBEX_KEY = "globex-dev-key";

class StubLlmService {
  async analyzeEmail(email: EmailForAnalysis): Promise<EmailAnalysis> {
    if (email.subject.startsWith("Task:")) {
      const assigneeMatch = email.body.match(/assign:(\S+)/);
      const dueMatch = email.body.match(/due:(\S+)/);
      return {
        isActionable: true,
        title: email.subject.replace("Task:", "").trim(),
        description: email.body,
        dueDate: dueMatch ? dueMatch[1] : null,
        assigneeEmail: assigneeMatch ? assigneeMatch[1] : null,
        confidence: 0.9,
      };
    }
    return {
      isActionable: false,
      title: null,
      description: null,
      dueDate: null,
      assigneeEmail: null,
      confidence: 0.05,
    };
  }
}

describe("email -> task flow (e2e)", () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let messageCounter = 0;

  const nextMessageId = () => `e2e-${Date.now()}-${++messageCounter}@test`;

  const postEmail = (payload: Record<string, unknown>, token = WEBHOOK_TOKEN) =>
    request(app.getHttpServer())
      .post("/webhooks/email")
      .set("x-webhook-token", token)
      .send(payload);

  const getTasks = (apiKey: string, query = "") =>
    request(app.getHttpServer()).get(`/tasks${query}`).set("x-api-key", apiKey);

  const waitForTask = async (apiKey: string, title: string, timeoutMs = 5000) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const res = await getTasks(apiKey);
      const found = res.body.items?.find((t: any) => t.title === title);
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Task "${title}" did not show up within ${timeoutMs}ms`);
  };

  const taskCount = async (apiKey: string): Promise<number> => {
    const res = await getTasks(apiKey);
    return res.body.total;
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("e2e");
    process.env.WEBHOOK_TOKEN = WEBHOOK_TOKEN;
    process.env.LLM_FAKE = "false";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LlmService)
      .useClass(StubLlmService)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    const connection = app.get<Connection>(getConnectionToken());
    await seedDemoData(connection);
  });

  afterAll(async () => {
    await app?.close();
    await mongod?.stop();
  });

  describe("webhook", () => {
    it("rejects requests without the provider token", async () => {
      await postEmail({ messageId: "x", from: "a@b.com", to: ["sara@acme.uz"] }, "wrong").expect(
        401,
      );
    });

    it("rejects malformed payloads", async () => {
      const res = await postEmail({ from: "not-an-email", to: [] });
      expect(res.status).toBe(400);
    });

    it("turns an actionable email into a pending task for the right company", async () => {
      await postEmail({
        messageId: nextMessageId(),
        from: "client@corp.com",
        to: ["sara@acme.uz"],
        subject: "Task: Update landing page",
        text: "please update the copy due:2026-07-20 assign:tom@acme.uz",
      }).expect(202);

      const task = await waitForTask(ACME_KEY, "Update landing page");
      expect(task.status).toBe("pending_review");
      expect(task.dueDate).toContain("2026-07-20");
      expect(task.assigneeEmail).toBe("tom@acme.uz");
      expect(task.assigneeId).toBeDefined();
      expect(task.source.from).toBe("client@corp.com");
    });

    it("does not leak tasks across tenants", async () => {
      const res = await getTasks(GLOBEX_KEY);
      expect(res.body.items).toHaveLength(0);
    });

    it("discards non-actionable emails", async () => {
      const before = await taskCount(ACME_KEY);

      await postEmail({
        messageId: nextMessageId(),
        from: "news@letter.com",
        to: ["sara@acme.uz"],
        subject: "Weekly digest",
        text: "here is your newsletter",
      }).expect(202);

      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(await taskCount(ACME_KEY)).toBe(before);
    });

    it("ignores emails to unknown recipients", async () => {
      const before = await taskCount(ACME_KEY);

      await postEmail({
        messageId: nextMessageId(),
        from: "someone@random.org",
        to: ["ghost@nowhere.test"],
        subject: "Task: This should go nowhere",
        text: "hello",
      }).expect(202);

      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(await taskCount(ACME_KEY)).toBe(before);
    });

    it("is idempotent on duplicate messageIds", async () => {
      const messageId = nextMessageId();
      const payload = {
        messageId,
        from: "client@corp.com",
        to: ["sara@acme.uz"],
        subject: "Task: Deduplicate me",
        text: "same email delivered twice",
      };

      await postEmail(payload).expect(202);
      await waitForTask(ACME_KEY, "Deduplicate me");
      const before = await taskCount(ACME_KEY);

      const res = await postEmail(payload).expect(202);
      expect(res.body.duplicate).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(await taskCount(ACME_KEY)).toBe(before);
    });

    it("drops assignees that are not users of the company", async () => {
      await postEmail({
        messageId: nextMessageId(),
        from: "client@corp.com",
        to: ["lena@globex.io"],
        subject: "Task: Check attacker assignee",
        text: "do the thing assign:ceo@evil.example",
      }).expect(202);

      const task = await waitForTask(GLOBEX_KEY, "Check attacker assignee");
      expect(task.assigneeEmail).toBeUndefined();
      expect(task.assigneeId).toBeUndefined();
    });
  });

  describe("tasks api", () => {
    it("requires an api key", async () => {
      await request(app.getHttpServer()).get("/tasks").expect(401);
      await request(app.getHttpServer()).get("/tasks").set("x-api-key", "nope").expect(401);
    });

    it("filters by status and paginates", async () => {
      const res = await getTasks(ACME_KEY, "?status=pending_review&page=1&limit=1").expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.limit).toBe(1);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
      expect(res.body.totalPages).toBeGreaterThanOrEqual(2);
    });

    it("rejects unknown status values", async () => {
      await getTasks(ACME_KEY, "?status=weird").expect(400);
    });

    it("accepts a pending task", async () => {
      const list = await getTasks(ACME_KEY, "?status=pending_review");
      const task = list.body.items[0];

      const res = await request(app.getHttpServer())
        .post(`/tasks/${task._id}/review`)
        .set("x-api-key", ACME_KEY)
        .send({ action: "accept" })
        .expect(201);

      expect(res.body.status).toBe("accepted");
      expect(res.body.reviewedAt).toBeDefined();
    });

    it("does not allow reviewing twice", async () => {
      const list = await getTasks(ACME_KEY, "?status=accepted");
      const task = list.body.items[0];

      await request(app.getHttpServer())
        .post(`/tasks/${task._id}/review`)
        .set("x-api-key", ACME_KEY)
        .send({ action: "reject" })
        .expect(409);
    });

    it("hides other tenants' tasks from review", async () => {
      const list = await getTasks(ACME_KEY);
      const task = list.body.items[0];

      await request(app.getHttpServer())
        .post(`/tasks/${task._id}/review`)
        .set("x-api-key", GLOBEX_KEY)
        .send({ action: "accept" })
        .expect(404);
    });

    it("rejects unknown review actions", async () => {
      const list = await getTasks(ACME_KEY);
      const task = list.body.items[0];

      await request(app.getHttpServer())
        .post(`/tasks/${task._id}/review`)
        .set("x-api-key", ACME_KEY)
        .send({ action: "maybe" })
        .expect(400);
    });
  });
});
