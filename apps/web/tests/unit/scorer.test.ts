/**
 * Scorer rule engine — viết theo contract Sprint 3:
 *   runRuleChecks(input) → ScoreCriterion[]; computeScores(criteria) → { seoScore, geoScore }; RULE_IDS.
 * Nếu src/lib/scorer.ts chưa tồn tại, toàn bộ describe được skip (xem _helpers.ts).
 */
import { describe, expect, it } from "vitest";
import type { ContentBrief, ScoreCriterion } from "@/lib/schemas";
import { describeIfModule, importIfExists } from "./_helpers";
import { BAD_ARTICLE, BAD_KEYWORD, BAD_META, BAD_SLUG, BAD_TITLE, GOOD_ARTICLE, GOOD_KEYWORD, GOOD_META, GOOD_SLUG, GOOD_TITLE } from "./fixtures/sample-article";

type ScorerModule = {
  runRuleChecks: (input: { markdown: string; title: string; slug: string; metaDescription: string; targetKeyword: string; brief: ContentBrief | null; locale: string }) => ScoreCriterion[];
  computeScores: (criteria: ScoreCriterion[]) => { seoScore: number; geoScore: number };
  RULE_IDS: readonly string[];
};

const EXPECTED_RULE_IDS = [
  "kw-in-title", "kw-in-h1", "kw-in-intro", "kw-in-meta", "kw-in-slug", "title-length", "meta-length", "single-h1", "heading-hierarchy",
  "word-count", "semantic-coverage", "keyword-density", "internal-links", "external-links", "images-alt", "has-table", "has-list", "has-faq",
  "updated-line", "answer-first", "sentence-length", "citations", "unverified-numbers",
];

const mod = await importIfExists<ScorerModule>("src/lib/scorer.ts");

const crit = (over: Partial<ScoreCriterion>): ScoreCriterion => ({
  id: "x", group: "seo", label: "x", status: "pass", reason: "", fix: "", source: "rule", weight: 1, ...over,
});

describeIfModule("scorer — runRuleChecks / computeScores", mod, "src/lib/scorer.ts", () => {
  const { runRuleChecks, computeScores, RULE_IDS } = mod!;
  const good = () => runRuleChecks({ markdown: GOOD_ARTICLE, title: GOOD_TITLE, slug: GOOD_SLUG, metaDescription: GOOD_META, targetKeyword: GOOD_KEYWORD, brief: null, locale: "vi-VN" });
  const bad = () => runRuleChecks({ markdown: BAD_ARTICLE, title: BAD_TITLE, slug: BAD_SLUG, metaDescription: BAD_META, targetKeyword: BAD_KEYWORD, brief: null, locale: "vi-VN" });
  const byId = (list: ScoreCriterion[]) => Object.fromEntries(list.map((c) => [c.id, c]));

  it("RULE_IDS chứa đủ 23 rule id theo contract, không trùng", () => {
    expect(new Set(RULE_IDS).size).toBe(RULE_IDS.length);
    for (const id of EXPECTED_RULE_IDS) expect(RULE_IDS, `thiếu rule ${id}`).toContain(id);
  });

  it("mỗi tiêu chí trả về đúng shape: id ∈ RULE_IDS, group seo|geo, source rule, weight 1–5, fix khi chưa pass", () => {
    for (const list of [good(), bad()]) {
      const ids = list.map((c) => c.id);
      expect(new Set(ids).size, "id phải duy nhất").toBe(ids.length);
      for (const c of list) {
        expect(RULE_IDS).toContain(c.id);
        expect(["seo", "geo"]).toContain(c.group);
        expect(["pass", "warn", "fail"]).toContain(c.status);
        expect(c.source).toBe("rule");
        expect(c.weight).toBeGreaterThanOrEqual(1);
        expect(c.weight).toBeLessThanOrEqual(5);
        expect(c.label.length).toBeGreaterThan(0);
        expect(c.reason.length).toBeGreaterThan(0);
        if (c.status !== "pass") expect(c.fix.trim().length, `rule ${c.id} (${c.status}) phải có hướng sửa`).toBeGreaterThan(0);
      }
    }
  });

  it("chạy đủ mọi rule cho một bài (mỗi id xuất hiện đúng 1 lần)", () => {
    const ids = good().map((c) => c.id).sort();
    expect(ids).toEqual([...EXPECTED_RULE_IDS].sort());
  });

  it("bài mẫu chuẩn: các tiêu chí cấu trúc/từ khoá đều pass, điểm cao", () => {
    const list = good();
    const m = byId(list);
    const mustPass = [
      "kw-in-title", "kw-in-h1", "kw-in-intro", "kw-in-meta", "kw-in-slug", "title-length", "meta-length", "single-h1", "heading-hierarchy",
      "word-count", "keyword-density", "internal-links", "external-links", "images-alt", "has-table", "has-list", "has-faq", "updated-line", "answer-first", "citations",
    ];
    const notPass = mustPass.filter((id) => m[id]?.status !== "pass").map((id) => `${id}: ${m[id]?.status} — ${m[id]?.reason}`);
    expect(notPass, notPass.join("\n")).toEqual([]);
    const fails = list.filter((c) => c.status === "fail");
    expect(fails.map((c) => `${c.id}: ${c.reason}`)).toEqual([]);
    const { seoScore, geoScore } = computeScores(list);
    expect(seoScore).toBeGreaterThanOrEqual(90);
    expect(geoScore).toBeGreaterThanOrEqual(85);
  });

  it("bài xấu (không H1, không FAQ, nhồi từ khoá, quá ngắn): fail đúng các id liên quan", () => {
    const m = byId(bad());
    for (const id of ["kw-in-h1", "single-h1", "has-faq", "has-table", "keyword-density", "kw-in-title", "kw-in-meta", "word-count", "updated-line", "internal-links"]) {
      expect(m[id]?.status, `${id} → ${m[id]?.reason}`).toBe("fail");
    }
    const { seoScore, geoScore } = computeScores(Object.values(m));
    expect(seoScore).toBeLessThan(40);
    expect(geoScore).toBeLessThan(40);
  });

  it("brief: word-count so với khoảng wordCountMin–Max của brief", () => {
    const brief = { wordCountMin: 2000, wordCountMax: 2500, targetKeyword: GOOD_KEYWORD, outline: [] } as unknown as ContentBrief;
    const m = byId(runRuleChecks({ markdown: GOOD_ARTICLE, title: GOOD_TITLE, slug: GOOD_SLUG, metaDescription: GOOD_META, targetKeyword: GOOD_KEYWORD, brief, locale: "vi-VN" }));
    expect(m["word-count"].status).not.toBe("pass");
    expect(m["word-count"].fix).toMatch(/2000/);
  });

  it("ảnh thiếu alt → images-alt fail; 2 H1 → single-h1 fail", () => {
    const md = GOOD_ARTICLE.replace("![Bảng tính tổng chi phí trả góp iPhone 17 Pro Max theo từng gói]", "![]") + "\n# H1 thứ hai\n";
    const m = byId(runRuleChecks({ markdown: md, title: GOOD_TITLE, slug: GOOD_SLUG, metaDescription: GOOD_META, targetKeyword: GOOD_KEYWORD, brief: null, locale: "vi-VN" }));
    expect(m["images-alt"].status).toBe("fail");
    expect(m["single-h1"].status).toBe("fail");
  });

  describe("computeScores", () => {
    it("tất cả pass → 100/100", () => {
      const r = computeScores([crit({ id: "a", group: "seo", weight: 5 }), crit({ id: "b", group: "seo", weight: 1 }), crit({ id: "c", group: "geo", weight: 3 })]);
      expect(r).toEqual({ seoScore: 100, geoScore: 100 });
    });
    it("tất cả fail → 0/0", () => {
      const r = computeScores([crit({ id: "a", group: "seo", status: "fail", weight: 5 }), crit({ id: "c", group: "geo", status: "fail", weight: 3 })]);
      expect(r).toEqual({ seoScore: 0, geoScore: 0 });
    });
    it("ví dụ trộn, tính tay theo trọng số: seo pass3/fail1 = 75; geo pass1/fail3 = 25", () => {
      const r = computeScores([
        crit({ id: "a", group: "seo", status: "pass", weight: 3 }),
        crit({ id: "b", group: "seo", status: "fail", weight: 1 }),
        crit({ id: "c", group: "geo", status: "pass", weight: 1 }),
        crit({ id: "d", group: "geo", status: "fail", weight: 3 }),
      ]);
      expect(r).toEqual({ seoScore: 75, geoScore: 25 });
    });
    it("warn nằm giữa pass và fail; nhóm không có tiêu chí → 0", () => {
      const allWarn = computeScores([crit({ id: "a", group: "seo", status: "warn", weight: 2 })]);
      expect(allWarn.seoScore).toBeGreaterThan(0);
      expect(allWarn.seoScore).toBeLessThan(100);
      expect(allWarn.geoScore).toBe(0);
      expect(computeScores([]).seoScore).toBe(0);
    });
    it("điểm luôn là số nguyên trong [0, 100]", () => {
      const r = computeScores([crit({ id: "a", group: "seo", status: "pass", weight: 1 }), crit({ id: "b", group: "seo", status: "fail", weight: 2 }), crit({ id: "c", group: "seo", status: "warn", weight: 4 })]);
      expect(Number.isInteger(r.seoScore)).toBe(true);
      expect(r.seoScore).toBeGreaterThanOrEqual(0);
      expect(r.seoScore).toBeLessThanOrEqual(100);
      // (1 + 0 + 2) / 7 = 42.86 → 43
      expect(r.seoScore).toBe(43);
    });
  });
});
