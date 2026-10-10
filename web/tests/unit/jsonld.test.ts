/**
 * JSON-LD sinh bằng code — theo contract Sprint 3:
 *   buildJsonLd({ project, article, brief }) → Record<string, unknown>[]; jsonLdScriptTag(objs) → string.
 * Nếu src/lib/jsonld.ts chưa tồn tại, describe được skip.
 */
import { describe, expect, it } from "vitest";
import type { ProjectProfile } from "@/lib/prompts";
import type { ContentBrief } from "@/lib/schemas";
import { describeIfModule, importIfExists } from "./_helpers";
import { GOOD_ARTICLE, GOOD_KEYWORD, GOOD_META, GOOD_SLUG, GOOD_TITLE } from "./fixtures/sample-article";

type JsonLdModule = {
  buildJsonLd: (input: {
    project: ProjectProfile;
    article: { title: string; slug: string; metaDescription: string; bodyMarkdown: string; targetKeyword: string; createdAt: Date; updatedAt: Date };
    brief: ContentBrief | null;
  }) => Record<string, unknown>[];
  jsonLdScriptTag: (objs: Record<string, unknown>[]) => string;
};

const mod = await importIfExists<JsonLdModule>("src/lib/jsonld.ts");

const project: ProjectProfile = {
  name: "Điện Thoại Giá Kho",
  domain: "giakho.vn",
  industry: "Bán lẻ điện thoại",
  locale: "vi-VN",
  brandVoice: null,
  entityProfile: { organization: "Giá Kho Group", authors: ["Chuyên gia Giá Kho"], sameAs: ["https://facebook.com/giakho"] },
};
const createdAt = new Date("2026-10-01T00:00:00Z");
const updatedAt = new Date("2026-10-10T00:00:00Z");
const article = { title: GOOD_TITLE, slug: GOOD_SLUG, metaDescription: GOOD_META, bodyMarkdown: GOOD_ARTICLE, targetKeyword: GOOD_KEYWORD, createdAt, updatedAt };

const typeOf = (objs: Record<string, unknown>[], t: string) => objs.find((o) => o["@type"] === t);

describeIfModule("jsonld — buildJsonLd / jsonLdScriptTag", mod, "src/lib/jsonld.ts", () => {
  const { buildJsonLd, jsonLdScriptTag } = mod!;

  it("luôn có Article với headline = title, ngày tạo/sửa ISO, inLanguage theo locale", () => {
    const objs = buildJsonLd({ project, article, brief: null });
    const a = typeOf(objs, "Article")!;
    expect(a).toBeTruthy();
    expect(a.headline).toBe(GOOD_TITLE);
    expect(a.datePublished).toBe(createdAt.toISOString());
    expect(a.dateModified).toBe(updatedAt.toISOString());
    expect(a.inLanguage).toBe("vi-VN");
    expect(a["@context"]).toBe("https://schema.org");
    expect(String(a.keywords)).toContain(GOOD_KEYWORD);
  });

  it("FAQPage khi bài có ≥ 2 cặp hỏi–đáp; mỗi Question có acceptedAnswer", () => {
    const objs = buildJsonLd({ project, article, brief: null });
    const faq = typeOf(objs, "FAQPage")!;
    expect(faq).toBeTruthy();
    const main = faq.mainEntity as { "@type": string; name: string; acceptedAnswer: { "@type": string; text: string } }[];
    expect(main).toHaveLength(3);
    for (const q of main) {
      expect(q["@type"]).toBe("Question");
      expect(q.name.length).toBeGreaterThan(0);
      expect(q.acceptedAnswer["@type"]).toBe("Answer");
      expect(q.acceptedAnswer.text.length).toBeGreaterThan(0);
    }
  });

  it("không có FAQPage khi chỉ có 1 FAQ hoặc không có mục FAQ", () => {
    const one = GOOD_ARTICLE.replace(/### Nợ xấu[\s\S]*$/, "");
    expect(typeOf(buildJsonLd({ project, article: { ...article, bodyMarkdown: one }, brief: null }), "FAQPage")).toBeUndefined();
    const none = GOOD_ARTICLE.replace(/## Câu hỏi thường gặp[\s\S]*$/, "");
    expect(typeOf(buildJsonLd({ project, article: { ...article, bodyMarkdown: none }, brief: null }), "FAQPage")).toBeUndefined();
  });

  it("BreadcrumbList chỉ khi project.domain có; URL tuyệt đối https + slug", () => {
    const withDomain = buildJsonLd({ project, article, brief: null });
    const bc = typeOf(withDomain, "BreadcrumbList")!;
    expect(bc).toBeTruthy();
    const items = bc.itemListElement as { position: number; item: string }[];
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[items.length - 1].item).toBe(`https://giakho.vn/${GOOD_SLUG}`);
    expect(items.map((i) => i.position)).toEqual(items.map((_, i) => i + 1));

    const noDomain = buildJsonLd({ project: { ...project, domain: null }, article, brief: null });
    expect(typeOf(noDomain, "BreadcrumbList")).toBeUndefined();
    expect(typeOf(noDomain, "Article")).toBeTruthy();
  });

  it("author lấy từ entityProfile.authors; publisher là tổ chức có sameAs", () => {
    const a = typeOf(buildJsonLd({ project, article, brief: null }), "Article")!;
    expect(a.author).toMatchObject({ "@type": "Person", name: "Chuyên gia Giá Kho" });
    expect(a.publisher).toMatchObject({ "@type": "Organization", name: "Giá Kho Group" });
  });

  it("brief bổ sung keywords từ outline", () => {
    const brief = { targetKeyword: GOOD_KEYWORD, metaDescription: "", outline: [{ level: 2, heading: "x", answerFirst: "", notes: "", keywords: ["phí chuyển đổi trả góp"], wordCount: 0 }] } as unknown as ContentBrief;
    const a = typeOf(buildJsonLd({ project, article, brief }), "Article")!;
    expect(String(a.keywords)).toContain("phí chuyển đổi trả góp");
  });

  it("jsonLdScriptTag: thẻ <script type=\"application/ld+json\"> với JSON hợp lệ bên trong, escape </script>", () => {
    const objs = buildJsonLd({ project, article: { ...article, title: "Tiêu đề </script><img src=x>" }, brief: null });
    const tag = jsonLdScriptTag(objs);
    expect(tag.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(tag.trimEnd().endsWith("</script>")).toBe(true);
    const inner = tag.slice(tag.indexOf(">") + 1, tag.lastIndexOf("</script>"));
    expect(inner).not.toContain("</script>");
    const parsed = JSON.parse(inner);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    expect(arr.some((o: Record<string, unknown>) => o["@type"] === "Article")).toBe(true);
    expect(arr.find((o: Record<string, unknown>) => o["@type"] === "Article").headline).toBe("Tiêu đề </script><img src=x>");
  });

  it("jsonLdScriptTag với 1 object → JSON object, nhiều → mảng (đều parse được)", () => {
    const one = JSON.parse(jsonLdScriptTag([{ "@type": "Thing" }]).replace(/^<script[^>]*>|<\/script>$/g, ""));
    expect(Array.isArray(one)).toBe(false);
    const many = JSON.parse(jsonLdScriptTag([{ "@type": "A" }, { "@type": "B" }]).replace(/^<script[^>]*>|<\/script>$/g, ""));
    expect(many).toHaveLength(2);
  });
});
