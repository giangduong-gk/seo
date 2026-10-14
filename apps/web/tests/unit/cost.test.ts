import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "@/lib/claude";

type Usage = Parameters<typeof estimateCostUsd>[1];
const usage = (u: Partial<Usage>): Usage => ({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: null, cache_creation_input_tokens: null, ...u }) as unknown as Usage;

describe("estimateCostUsd — bảng giá USD/1M token", () => {
  it("opus: 1M input = $4, 1M output = $20", () => {
    expect(estimateCostUsd("claude-opus-5-5", usage({ input_tokens: 1_000_000 }))).toBeCloseTo(4, 8);
    expect(estimateCostUsd("claude-opus-5-5", usage({ output_tokens: 1_000_000 }))).toBeCloseTo(20, 8);
  });

  it("tính gộp input + output + cache read + cache write (khớp công thức seed.mjs)", () => {
    // seed.mjs: (6200*4 + 4100*20 + 3800*0.2) / 1e6
    const c = estimateCostUsd("claude-opus-5-5", usage({ input_tokens: 6200, output_tokens: 4100, cache_read_input_tokens: 3800, cache_creation_input_tokens: 0 }));
    expect(c).toBeCloseTo((6200 * 4 + 4100 * 20 + 3800 * 0.2) / 1e6, 10);
    const w = estimateCostUsd("claude-opus-5-5", usage({ cache_creation_input_tokens: 1_000_000 }));
    expect(w).toBeCloseTo(5, 8);
  });

  it("sonnet và haiku rẻ hơn opus", () => {
    const u = usage({ input_tokens: 10_000, output_tokens: 2_000 });
    const opus = estimateCostUsd("claude-opus-5-5", u);
    const sonnet = estimateCostUsd("claude-sonnet-5-5", u);
    const haiku = estimateCostUsd("claude-haiku-5-5", u);
    expect(sonnet).toBeCloseTo((10_000 * 2 + 2_000 * 10) / 1e6, 10);
    expect(haiku).toBeCloseTo((10_000 * 0.1 + 2_000 * 0.5) / 1e6, 10);
    expect(opus).toBeGreaterThan(sonnet);
    expect(sonnet).toBeGreaterThan(haiku);
  });

  it("model lạ → rơi về giá opus; cache null/undefined → 0", () => {
    const u = usage({ input_tokens: 1000, output_tokens: 1000 });
    expect(estimateCostUsd("claude-unknown-9", u)).toBeCloseTo(estimateCostUsd("claude-opus-5-5", u), 12);
    expect(estimateCostUsd("claude-opus-5-5", usage({}))).toBe(0);
  });
});
