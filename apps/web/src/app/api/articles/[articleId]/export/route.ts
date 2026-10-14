import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toProfile } from "@/lib/project";
import { baseUrlOf, buildJsonLd, jsonLdScriptTag, parseStoredBrief } from "@/lib/jsonld";
import { renderMarkdown } from "@/lib/markdown";

/**
 * Xuất bài viết: ?format=md|html|jsonld (mặc định md), ?download=1 để tải file.
 * HTML là trang độc lập để đăng — không dùng design system của app.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const EXPORT_CSS = `
:root{color-scheme:light dark;--fg:#1a1a1a;--bg:#fff;--muted:#555;--line:#ddd;--link:#0b57d0}
@media(prefers-color-scheme:dark){:root{--fg:#e6e6e6;--bg:#121212;--muted:#aaa;--line:#333;--link:#8ab4f8}}
html{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.65;color:var(--fg);background:var(--bg)}
body{margin:0;padding:24px 16px}
article{max-width:720px;margin:0 auto}
h1{font-size:2rem;line-height:1.25;margin:.5em 0}
h2{font-size:1.5rem;margin:1.6em 0 .5em}
h3{font-size:1.2rem;margin:1.3em 0 .4em}
p,ul,ol{margin:.8em 0}
a{color:var(--link)}
table{border-collapse:collapse;width:100%;margin:1em 0;font-size:.95rem}
th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
th{background:rgba(127,127,127,.12)}
blockquote{margin:1em 0;padding:.2em 1em;border-left:3px solid var(--line);color:var(--muted)}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em}
img{max-width:100%;height:auto}
`.trim();

export async function GET(req: Request, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  const article = await prisma.article.findUnique({ where: { id: articleId }, include: { project: true, brief: true } });
  if (!article) return NextResponse.json({ error: "Không tìm thấy bài viết" }, { status: 404 });

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "md").toLowerCase();
  const download = Boolean(url.searchParams.get("download"));
  const project = toProfile(article.project);
  const brief = parseStoredBrief(article.brief?.data);
  const filename = article.slug || article.id;

  // JSON-LD: dùng bản đã lưu; nếu chưa có thì dựng lại từ bài hiện tại
  let jsonLd: Record<string, unknown>[] | null = null;
  if (article.jsonLd) {
    try {
      const parsed = JSON.parse(article.jsonLd);
      jsonLd = Array.isArray(parsed) ? parsed : [parsed];
    } catch { jsonLd = null; }
  }
  if (!jsonLd) {
    jsonLd = buildJsonLd({
      project,
      brief,
      article: {
        title: article.title,
        slug: article.slug,
        metaDescription: article.metaDescription,
        bodyMarkdown: article.bodyMarkdown,
        targetKeyword: article.targetKeyword,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
      },
    });
  }

  let body: string;
  let contentType: string;
  let ext: string;

  if (format === "html") {
    const base = baseUrlOf(project.domain);
    const canonical = base ? `${base}/${article.slug}` : null;
    body = [
      "<!doctype html>",
      `<html lang="${esc(project.locale)}">`,
      "<head>",
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<title>${esc(article.title)}</title>`,
      article.metaDescription ? `<meta name="description" content="${esc(article.metaDescription)}">` : null,
      canonical ? `<link rel="canonical" href="${esc(canonical)}">` : null,
      jsonLdScriptTag(jsonLd),
      `<style>${EXPORT_CSS}</style>`,
      "</head>",
      "<body>",
      "<article>",
      renderMarkdown(article.bodyMarkdown),
      "</article>",
      "</body>",
      "</html>",
    ].filter(Boolean).join("\n");
    contentType = "text/html; charset=utf-8";
    ext = "html";
  } else if (format === "jsonld") {
    body = JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : jsonLd, null, 2);
    contentType = "application/ld+json; charset=utf-8";
    ext = "jsonld";
  } else if (format === "md") {
    body = article.bodyMarkdown;
    contentType = "text/markdown; charset=utf-8";
    ext = "md";
  } else {
    return NextResponse.json({ error: "format phải là md | html | jsonld" }, { status: 400 });
  }

  const headers: Record<string, string> = { "Content-Type": contentType };
  if (download) headers["Content-Disposition"] = `attachment; filename="${filename}.${ext}"`;
  return new NextResponse(body, { headers });
}
