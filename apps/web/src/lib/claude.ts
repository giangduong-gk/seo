import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";

export const MODELS = {
  analysis: process.env.CLAUDE_MODEL_ANALYSIS || "claude-opus-5-5",
  bulk: "claude-sonnet-5-5",
  classify: "claude-haiku-5-5",
} as const;

/** Giá USD / 1M token (Claude API, 2026-10). Dùng để ghi chi phí ước tính. */
const PRICE: Record<string, { in: number; out: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

let client: Anthropic | null = null;
export function claude(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Thiếu ANTHROPIC_API_KEY. Thêm vào file apps/web/.env rồi khởi động lại.");
  }
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 10 * 60 * 1000 });
  return client;
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function estimateCostUsd(model: string, u: Anthropic.Usage): number {
  const p = PRICE[model] ?? PRICE["claude-opus-5-5"];
  const m = 1_000_000;
  return (
    (u.input_tokens * p.in +
      u.output_tokens * p.out +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) /
    m
  );
}

/** Ghi lại token/chi phí của một lần gọi vào bảng AiUsage. */
export async function recordUsage(opts: {
  projectId?: string;
  feature: string;
  model: string;
  usage: Anthropic.Usage;
}) {
  const { usage } = opts;
  await prisma.aiUsage.create({
    data: {
      projectId: opts.projectId,
      feature: opts.feature,
      model: opts.model,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
      costUsd: estimateCostUsd(opts.model, usage),
    },
  });
}

export class RefusalError extends Error {
  constructor(public category: string | null, explanation?: string | null) {
    super(explanation || "Model từ chối xử lý yêu cầu này.");
    this.name = "RefusalError";
  }
}

/** Ném RefusalError nếu phản hồi là refusal — luôn gọi trước khi đọc content. */
export function assertNotRefused(msg: Anthropic.Message) {
  if (msg.stop_reason === "refusal") {
    const d = msg.stop_details;
    throw new RefusalError(d && d.type === "refusal" ? d.category : null, d?.explanation);
  }
}

export function textOf(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
