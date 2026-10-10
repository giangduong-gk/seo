import type { ProjectProfile } from "./prompts";
import { ContentBrief } from "./schemas";
import { extractHeadings, parseFaq, wordCount } from "./markdown";

/**
 * Sinh JSON-LD (schema.org) bằng code thuần từ bài viết + hồ sơ dự án + brief.
 * Không gọi Claude — kết quả ổn định, tái tạo được mỗi khi bài thay đổi.
 */

export type JsonLdInput = {
  project: ProjectProfile;
  article: {
    title: string;
    slug: string;
    metaDescription: string;
    bodyMarkdown: string;
    targetKeyword: string;
    createdAt: Date;
    updatedAt: Date;
  };
  brief: ContentBrief | null;
};

/** Chuẩn hoá domain thành base URL: bỏ scheme và dấu "/" cuối, luôn dùng https. */
export function baseUrlOf(domain: string | null | undefined): string | null {
  const d = (domain ?? "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return d ? `https://${d}` : null;
}

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const s = raw.trim();
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function buildJsonLd(input: JsonLdInput): Record<string, unknown>[] {
  const { project, article, brief } = input;
  const entity = project.entityProfile ?? {};
  const base = baseUrlOf(project.domain);
  const articleUrl = base ? `${base}/${article.slug}` : null;
  const orgName = entity.organization || project.name;
  const authorName = entity.authors?.[0];

  const organization: Record<string, unknown> = { "@type": "Organization", name: orgName };
  if (base) organization.url = base;
  if (entity.sameAs?.length) organization.sameAs = entity.sameAs;

  const author: Record<string, unknown> = authorName
    ? { "@type": "Person", name: authorName }
    : { ...organization };

  const headings = extractHeadings(article.bodyMarkdown);
  const sections = uniq(headings.filter((h) => h.level === 2).map((h) => h.text));
  const keywords = uniq([
    article.targetKeyword,
    ...(brief?.outline.flatMap((o) => o.keywords) ?? []),
  ]);

  const articleLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.metaDescription || brief?.metaDescription || undefined,
    inLanguage: project.locale,
    keywords: keywords.join(", "),
    datePublished: article.createdAt.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author,
    publisher: organization,
    wordCount: wordCount(article.bodyMarkdown),
  };
  if (articleUrl) articleLd.mainEntityOfPage = { "@type": "WebPage", "@id": articleUrl };
  if (sections.length) articleLd.articleSection = sections;
  // Bỏ các trường undefined để JSON gọn
  for (const k of Object.keys(articleLd)) if (articleLd[k] === undefined) delete articleLd[k];

  const out: Record<string, unknown>[] = [articleLd];

  // FAQPage: chỉ khi có ≥ 2 cặp hỏi–đáp thực sự trong bài
  const faq = parseFaq(article.bodyMarkdown);
  if (faq.length >= 2) {
    out.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }

  // BreadcrumbList: Trang chủ → bài viết (cần domain để có URL tuyệt đối)
  if (base && articleUrl) {
    out.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Trang chủ", item: base },
        { "@type": "ListItem", position: 2, name: article.title, item: articleUrl },
      ],
    });
  }

  // Organization độc lập: chỉ khi dự án khai báo tổ chức rõ ràng
  if (entity.organization) {
    out.push({ "@context": "https://schema.org", ...organization });
  }

  return out;
}

/** Thẻ <script type="application/ld+json"> để dán vào <head>. Escape "</" để không phá HTML. */
export function jsonLdScriptTag(objects: Record<string, unknown>[]): string {
  const json = JSON.stringify(objects.length === 1 ? objects[0] : objects, null, 2).replace(/<\//g, "<\\/");
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

/** Parse JSON brief lưu trong DB; trả null nếu lỗi hoặc không đúng schema. */
export function parseStoredBrief(json: string | null | undefined): ContentBrief | null {
  if (!json) return null;
  try {
    const r = ContentBrief.safeParse(JSON.parse(json));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
