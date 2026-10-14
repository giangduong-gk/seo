import { describe, expect, it } from "vitest";
import { detectKeywordOverlap } from "@/lib/overlap";

describe("detectKeywordOverlap — rule engine phát hiện cannibalization", () => {
  it("báo cặp cùng ý định, trùng token ≥ 60% (bỏ stop-word 'bao nhiêu')", () => {
    const out = detectKeywordOverlap([
      { term: "giá iphone 17 pro max", intent: "commercial" },
      { term: "iphone 17 pro max giá bao nhiêu", intent: "commercial" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ a: "giá iphone 17 pro max", b: "iphone 17 pro max giá bao nhiêu", sameIntent: true });
    expect(out[0].similarity).toBeCloseTo(1, 5);
  });

  it("không báo khi ý định khác nhau dù trùng token", () => {
    const out = detectKeywordOverlap([
      { term: "giá iphone 17 pro max", intent: "commercial" },
      { term: "iphone 17 pro max giá bao nhiêu", intent: "informational" },
    ]);
    expect(out).toEqual([]);
  });

  it("không báo khi ý định thiếu (null/undefined) — không coi là cùng ý định", () => {
    expect(detectKeywordOverlap([{ term: "giá iphone 17 pro max", intent: null }, { term: "giá iphone 17 pro max" }])).toEqual([]);
  });

  it("không báo khi độ tương đồng dưới ngưỡng", () => {
    const out = detectKeywordOverlap([
      { term: "iphone 17 pro max", intent: "commercial" },
      { term: "samsung galaxy s26 ultra", intent: "commercial" },
    ]);
    expect(out).toEqual([]);
  });

  it("chuẩn hoá hoa/thường và dấu câu", () => {
    const out = detectKeywordOverlap([
      { term: "iPhone 17 Pro Max!", intent: "commercial" },
      { term: "iphone 17 pro max", intent: "commercial" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].similarity).toBe(1);
  });

  it("tôn trọng tham số threshold", () => {
    const items = [
      { term: "iphone 17 pro max 256gb", intent: "commercial" }, // 5 token
      { term: "iphone 17 pro max", intent: "commercial" }, // 4 token → jaccard 4/5 = 0.8
    ];
    expect(detectKeywordOverlap(items, 0.9)).toEqual([]);
    expect(detectKeywordOverlap(items, 0.8)).toHaveLength(1);
  });

  it("sắp xếp giảm dần theo similarity", () => {
    const out = detectKeywordOverlap([
      { term: "iphone 17 pro max 256gb", intent: "commercial" },
      { term: "iphone 17 pro max", intent: "commercial" },
      { term: "iphone 17 pro max giá", intent: "commercial" },
      { term: "giá iphone 17 pro max", intent: "commercial" },
    ]);
    expect(out.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < out.length; i++) expect(out[i - 1].similarity).toBeGreaterThanOrEqual(out[i].similarity);
    expect(out[0].similarity).toBe(1);
  });

  it("danh sách rỗng hoặc 1 phần tử → []", () => {
    expect(detectKeywordOverlap([])).toEqual([]);
    expect(detectKeywordOverlap([{ term: "a", intent: "x" }])).toEqual([]);
  });
});
