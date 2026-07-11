import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { LlmService } from "./llm.service";

const mockCreate = jest.fn();

jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

describe("LlmService", () => {
  let service: LlmService;
  let env: Record<string, string | undefined>;

  beforeEach(async () => {
    env = { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "gpt-4o-mini", LLM_FAKE: "false" };
    mockCreate.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [
        LlmService,
        { provide: ConfigService, useValue: { get: (key: string) => env[key] } },
      ],
    }).compile();

    service = moduleRef.get(LlmService);
  });

  const respondWith = (payload: unknown) => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(payload), refusal: null } }],
    });
  };

  it("parses a valid actionable response", async () => {
    respondWith({
      actionable: true,
      title: "Update landing page copy",
      description: "Replace hero copy before campaign start",
      due_date: "2026-07-17",
      assignee_email: "Sara@Acme.uz",
      confidence: 0.92,
    });

    const result = await service.analyzeEmail({ from: "a@b.com", subject: "s", body: "b" });

    expect(result.isActionable).toBe(true);
    expect(result.title).toBe("Update landing page copy");
    expect(result.dueDate).toBe("2026-07-17");
    expect(result.assigneeEmail).toBe("sara@acme.uz");
    expect(result.confidence).toBe(0.92);
  });

  it("returns not actionable when the model says so", async () => {
    respondWith({
      actionable: false,
      title: null,
      description: null,
      due_date: null,
      assignee_email: null,
      confidence: 0.1,
    });

    const result = await service.analyzeEmail({ from: "a@b.com", subject: "s", body: "b" });
    expect(result.isActionable).toBe(false);
    expect(result.title).toBeNull();
  });

  it("treats actionable without a title as not actionable", async () => {
    respondWith({
      actionable: true,
      title: null,
      description: "something",
      due_date: null,
      assignee_email: null,
      confidence: 0.8,
    });

    const result = await service.analyzeEmail({ from: "a@b.com", subject: "s", body: "b" });
    expect(result.isActionable).toBe(false);
  });

  it("drops invalid due dates and clamps confidence", async () => {
    respondWith({
      actionable: true,
      title: "Do the thing",
      description: null,
      due_date: "next friday maybe",
      assignee_email: "not-an-email",
      confidence: 42,
    });

    const result = await service.analyzeEmail({ from: "a@b.com", subject: "s", body: "b" });
    expect(result.dueDate).toBeNull();
    expect(result.assigneeEmail).toBeNull();
    expect(result.confidence).toBe(1);
  });

  it("returns not actionable on refusal", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null, refusal: "cannot comply" } }],
    });

    const result = await service.analyzeEmail({ from: "a@b.com", subject: "s", body: "b" });
    expect(result.isActionable).toBe(false);
  });

  it("truncates very long bodies before sending them to the model", async () => {
    respondWith({
      actionable: false,
      title: null,
      description: null,
      due_date: null,
      assignee_email: null,
      confidence: 0,
    });

    await service.analyzeEmail({ from: "a@b.com", subject: "s", body: "x".repeat(50000) });

    const sent = mockCreate.mock.calls[0][0].messages[1].content as string;
    expect(sent.length).toBeLessThan(10000);
  });

  it("throws a clear error when no api key is configured", async () => {
    env.OPENAI_API_KEY = undefined;
    await expect(
      service.analyzeEmail({ from: "a@b.com", subject: "s", body: "b" }),
    ).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it("uses the keyword heuristic when LLM_FAKE is on", async () => {
    env.LLM_FAKE = "true";

    const actionable = await service.analyzeEmail({
      from: "a@b.com",
      subject: "Please fix the login bug",
      body: "It breaks on iOS, deadline 2026-07-20",
    });
    expect(actionable.isActionable).toBe(true);
    expect(actionable.dueDate).toBe("2026-07-20");

    const boring = await service.analyzeEmail({
      from: "a@b.com",
      subject: "Weekly digest",
      body: "Here is what happened this week",
    });
    expect(boring.isActionable).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
