import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ClusterMap, ContentBrief, KeywordAnalysis, ScoreCriterion } from "@/lib/schemas";
import { WEB_ROOT } from "./_helpers";

const load = (f: string) => JSON.parse(readFileSync(path.join(WEB_ROOT, "prisma/fixtures", f), "utf8"));

describe("Fixtures seed phải hợp lệ với Zod schema", () => {
  it("sample-analysis.json → KeywordAnalysis", () => {
    const r = KeywordAnalysis.safeParse(load("sample-analysis.json"));
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues, null, 2)).toBe(true);
    if (!r.success) return;
    expect(r.data.keywords.some((k) => k.role === "primary")).toBe(true);
    expect(r.data.geoChecklist.length).toBeGreaterThan(0);
    expect(r.data.faq.length).toBeGreaterThan(0);
  });

  it("sample-cluster.json → ClusterMap; đúng 1 pillar; link trỏ tới node tồn tại", () => {
    const r = ClusterMap.safeParse(load("sample-cluster.json"));
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues, null, 2)).toBe(true);
    if (!r.success) return;
    const ids = new Set(r.data.nodes.map((n) => n.id));
    expect(ids.size).toBe(r.data.nodes.length);
    expect(r.data.nodes.filter((n) => n.kind === "pillar")).toHaveLength(1);
    expect(r.data.nodes.length).toBeGreaterThanOrEqual(5);
    expect(r.data.links.length).toBeGreaterThanOrEqual(5);
    for (const l of r.data.links) {
      expect(ids.has(l.fromId), `fromId ${l.fromId}`).toBe(true);
      expect(ids.has(l.toId), `toId ${l.toId}`).toBe(true);
    }
    for (const n of r.data.nodes) if (n.parentId) expect(ids.has(n.parentId), `parentId ${n.parentId}`).toBe(true);
  });

  it("sample-brief.json → ContentBrief; outline bắt đầu bằng H1; title ≤ 60; meta ≤ 155", () => {
    const r = ContentBrief.safeParse(load("sample-brief.json"));
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues, null, 2)).toBe(true);
    if (!r.success) return;
    expect(r.data.outline[0].level).toBe(1);
    expect(Array.from(r.data.title).length).toBeLessThanOrEqual(60);
    expect(Array.from(r.data.metaDescription).length).toBeLessThanOrEqual(155);
    expect(r.data.wordCountMin).toBeLessThanOrEqual(r.data.wordCountMax);
    expect(r.data.faq.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Schema từ chối dữ liệu sai", () => {
  it("KeywordAnalysis: intent ngoài enum, intentConfidence > 1", () => {
    const a = load("sample-analysis.json");
    expect(KeywordAnalysis.safeParse({ ...a, intent: "buying" }).success).toBe(false);
    expect(KeywordAnalysis.safeParse({ ...a, intentConfidence: 1.5 }).success).toBe(false);
  });
  it("ClusterMap: cannibalization cần ≥ 2 nodeIds", () => {
    const c = load("sample-cluster.json");
    expect(ClusterMap.safeParse({ ...c, cannibalization: [{ nodeIds: ["c1"], reason: "x", fix: "y" }] }).success).toBe(false);
  });
  it("ScoreCriterion: status/group/source ngoài enum bị từ chối", () => {
    const ok = { id: "kw-in-title", group: "seo", label: "x", status: "pass", reason: "r", fix: "", source: "rule", weight: 5 };
    expect(ScoreCriterion.safeParse(ok).success).toBe(true);
    expect(ScoreCriterion.safeParse({ ...ok, status: "ok" }).success).toBe(false);
    expect(ScoreCriterion.safeParse({ ...ok, group: "ux" }).success).toBe(false);
    expect(ScoreCriterion.safeParse({ ...ok, source: "human" }).success).toBe(false);
  });
});
