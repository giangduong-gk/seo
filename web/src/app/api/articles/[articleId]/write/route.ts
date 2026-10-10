import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RefusalError } from "@/lib/claude";
import { toProfile } from "@/lib/project";
import { streamArticle } from "@/lib/writer";
import { buildJsonLd, parseStoredBrief } from "@/lib/jsonld";
import { wordCount } from "@/lib/markdown";
import type { WriterEvent, WriterMode } from "@/lib/schemas";

// Stream dài (bài 2000 từ + thinking) — không cache, cho phép tới 10 phút.
export const dynamic = "force-dynamic";
export const maxDuration = 600;

const MODES: WriterMode[] = ["write", "fix", "rewrite"];

/** Ghi chú cho bản lưu trước khi AI ghi đè. */
function revisionNote(mode: WriterMode, instruction: string): string {
  const snippet = instruction.replace(/\s+/g, " ").slice(0, 120);
  if (mode === "write") return "Trước khi AI viết mới";
  if (mode === "fix") return `Trước khi AI sửa: ${snippet}`;
  return `Trước khi AI viết lại: ${snippet}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;

  let body: { mode?: unknown; instruction?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body phải là JSON" }, { status: 400 });
  }
  const mode = body.mode as WriterMode;
  if (!MODES.includes(mode)) return NextResponse.json({ error: "mode phải là write | fix | rewrite" }, { status: 400 });
  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";

  const article = await prisma.article.findUnique({ where: { id: articleId }, include: { project: true, brief: true } });
  if (!article) return NextResponse.json({ error: "Không tìm thấy bài viết" }, { status: 404 });
  if (article.status === "writing") return NextResponse.json({ error: "Bài đang được viết, vui lòng đợi" }, { status: 409 });

  const brief = parseStoredBrief(article.brief?.data);
  if ((mode === "fix" || mode === "rewrite") && !instruction) {
    return NextResponse.json({ error: "Chế độ sửa/viết lại cần có hướng dẫn" }, { status: 400 });
  }
  if ((mode === "fix" || mode === "rewrite") && !article.bodyMarkdown.trim()) {
    return NextResponse.json({ error: "Bài chưa có nội dung để sửa" }, { status: 400 });
  }
  if (mode === "write" && !brief && !article.targetKeyword.trim()) {
    return NextResponse.json({ error: "Cần brief hoặc từ khoá mục tiêu để viết bài" }, { status: 400 });
  }

  const previousBody = article.bodyMarkdown;
  const project = toProfile(article.project);
  await prisma.article.update({ where: { id: articleId }, data: { status: "writing" } });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let clientGone = false;
      const send = (event: WriterEvent) => {
        if (clientGone) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          clientGone = true; // client đã ngắt — vẫn tiếp tục để lưu bài
        }
      };

      try {
        const { markdown } = await streamArticle(
          {
            project,
            projectId: article.projectId,
            brief,
            article: {
              title: article.title,
              slug: article.slug,
              metaDescription: article.metaDescription,
              targetKeyword: article.targetKeyword,
              bodyMarkdown: article.bodyMarkdown,
            },
            mode,
            instruction,
          },
          (delta) => send({ type: "delta", text: delta }),
        );
        if (!markdown) throw new Error("Model không trả về nội dung.");

        const now = new Date();
        const jsonLd = buildJsonLd({
          project,
          brief,
          article: {
            title: article.title,
            slug: article.slug,
            metaDescription: article.metaDescription,
            bodyMarkdown: markdown,
            targetKeyword: article.targetKeyword,
            createdAt: article.createdAt,
            updatedAt: now,
          },
        });
        await prisma.$transaction([
          ...(previousBody.trim()
            ? [prisma.articleRevision.create({ data: { articleId, bodyMarkdown: previousBody, note: revisionNote(mode, instruction) } })]
            : []),
          prisma.article.update({
            where: { id: articleId },
            data: { bodyMarkdown: markdown, jsonLd: JSON.stringify(jsonLd), status: "review" },
          }),
        ]);
        send({ type: "done", articleId, words: wordCount(markdown) });
      } catch (e: unknown) {
        console.error("[article_write]", e instanceof Error ? `${e.name}: ${e.message}` : e);
        const message =
          e instanceof RefusalError
            ? `Model từ chối yêu cầu này (${e.category ?? "không rõ lý do"}). Thử diễn đạt lại.`
            : e instanceof Error ? e.message : "Lỗi không xác định";
        await prisma.article
          .update({ where: { id: articleId }, data: { status: previousBody.trim() ? "review" : "draft" } })
          .catch(() => undefined);
        send({ type: "error", message });
      } finally {
        try {
          controller.close();
        } catch {
          /* đã đóng */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
