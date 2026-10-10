import type Anthropic from "@anthropic-ai/sdk";
import { MODELS, assertNotRefused, claude, recordUsage, textOf } from "./claude";
import { projectProfilePrompt, standards2026, type ProjectProfile } from "./prompts";
import type { ContentBrief, WriterMode } from "./schemas";
import { briefToMarkdown } from "./brief";
import { slugify } from "./markdown";

/**
 * AI Writer: viết mới / sửa / viết lại bài theo brief, stream từng đoạn text.
 * Prompt caching: standards → hồ sơ dự án → brief (mỗi block một breakpoint, tối đa 4).
 */

export type WriterInput = {
  project: ProjectProfile;
  projectId: string;
  brief: ContentBrief | null;
  article: { title: string; slug: string; metaDescription: string; targetKeyword: string; bodyMarkdown: string };
  /** "write" = viết mới từ brief; "fix" = áp dụng 1 hướng dẫn sửa, trả về TOÀN BỘ bài; "rewrite" = viết lại theo chỉ dẫn. */
  mode: WriterMode;
  /** Bắt buộc với fix/rewrite. */
  instruction?: string | null;
};

type Effort = "low" | "medium" | "high";

/** Đọc CLAUDE_EFFORT_WRITER, chỉ chấp nhận low|medium|high; mặc định medium. */
function writerEffort(): Effort {
  const v = (process.env.CLAUDE_EFFORT_WRITER ?? "medium").trim().toLowerCase();
  return v === "low" || v === "high" ? v : "medium";
}

/** Ngày hôm nay dạng dd/mm/yyyy (giờ máy chủ). */
function todayVi(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function systemBlocks(project: ProjectProfile, brief: ContentBrief | null): Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: standards2026(), cache_control: { type: "ephemeral" } },
    { type: "text", text: projectProfilePrompt(project), cache_control: { type: "ephemeral" } },
  ];
  if (brief) {
    blocks.push({
      type: "text",
      text: "# Content Brief\nĐây là brief chính thức của bài. Writer phải bám sát outline, góc viết, nguồn và mục \"Không được\".\n\n" + briefToMarkdown(brief),
      cache_control: { type: "ephemeral" },
    });
  }
  return blocks;
}

/** Quy tắc viết dùng chung cho cả 3 chế độ. */
function writingRules(input: WriterInput): string {
  const { project, brief, article } = input;
  const title = article.title || brief?.title || article.targetKeyword;
  const lines = [
    "## Quy tắc đầu ra (bắt buộc)",
    "- Chỉ xuất BÀI VIẾT ở định dạng Markdown. Không lời dẫn, không nhận xét, không giải thích, không bọc trong code fence, không front matter.",
    `- Dòng đầu tiên là H1: \`# ${title}\`. Ngay sau H1 là một dòng in nghiêng: \`*Cập nhật lần cuối: ${todayVi()}*\`.`,
    brief
      ? "- Bám sát outline trong brief (H2/H3 đúng thứ tự, đúng cấp). Mỗi H2 mở đầu bằng câu trả lời trực tiếp (answer-first) rồi mới giải thích chi tiết."
      : "- Tự xây outline 6–10 H2 (có H3 khi cần) bao phủ đủ ý định tìm kiếm của từ khoá. Mỗi H2 mở đầu bằng câu trả lời trực tiếp (answer-first).",
    "- Dùng bảng, danh sách hoặc các bước đánh số ở những mục brief yêu cầu (ghi chú outline, multi-format) hoặc khi dữ liệu dạng so sánh.",
    "- Mọi con số, giá, tỷ lệ phải kèm nguồn và thời điểm. Số liệu không chắc chắn phải ghi `(cần kiểm chứng)` ngay sau số đó. Không bịa số liệu.",
    "- Chỉ dẫn nguồn có trong brief hoặc nguồn chính thống nổi tiếng (cơ quan nhà nước, hãng sản xuất, tổ chức quốc tế). TUYỆT ĐỐI không bịa URL; nếu không chắc URL, chỉ ghi tên nguồn.",
    "- Có mục `## Câu hỏi thường gặp`; mỗi câu hỏi là một heading `### `, câu trả lời ngắn gọn, answer-first ngay câu đầu.",
    `- Ngôn ngữ: ${project.locale}.${project.brandVoice ? ` Giọng văn thương hiệu: ${project.brandVoice}.` : ""}${brief?.tone ? ` Tone theo brief: ${brief.tone}.` : ""}`,
    brief
      ? `- Độ dài toàn bài: ${brief.wordCountMin}–${brief.wordCountMax} từ (không tính heading).`
      : "- Độ dài toàn bài: 1200–2000 từ.",
    "- Từ khoá mục tiêu xuất hiện tự nhiên ở H1, đoạn mở đầu, ít nhất một H2 và phần kết; không nhồi nhét.",
    "- Không dùng ký tự lạ, không emoji, không viết hoa toàn bộ câu.",
  ];

  const internal = brief?.links.filter((l) => l.type === "internal") ?? [];
  if (internal.length) {
    lines.push("- Internal link (Markdown link, đặt ở vị trí tự nhiên trong bài, dùng đúng anchor):");
    for (const l of internal) lines.push(`  - [${l.anchor}](/${slugify(l.to)}) → bài "${l.to}"${l.why ? ` — ${l.why}` : ""}`);
  }
  const external = brief?.links.filter((l) => l.type === "external") ?? [];
  if (external.length) {
    lines.push("- External link được phép (chỉ khi có URL thật trong brief hoặc là trang chủ chính thức):");
    for (const l of external) lines.push(`  - ${l.to} · anchor: "${l.anchor}"`);
  }
  return lines.join("\n");
}

function userPrompt(input: WriterInput): string {
  const { brief, article, mode, instruction } = input;
  const meta = [
    `- Tiêu đề: ${article.title || brief?.title || "(theo brief)"}`,
    `- Từ khoá mục tiêu: ${article.targetKeyword || brief?.targetKeyword || "(theo brief)"}`,
    `- Slug: /${article.slug || brief?.slug || ""}`,
    (article.metaDescription || brief?.metaDescription) ? `- Meta description: ${article.metaDescription || brief?.metaDescription}` : null,
  ].filter(Boolean).join("\n");

  if (mode === "write") {
    return [
      brief
        ? "Viết bài hoàn chỉnh theo Content Brief trong system prompt."
        : "Không có brief. Viết bài hoàn chỉnh cho từ khoá mục tiêu dưới đây, tự xác định ý định tìm kiếm và outline phù hợp.",
      "## Thông tin bài",
      meta,
      writingRules(input),
    ].join("\n\n");
  }

  const current = `<bai_viet_hien_tai>\n${article.bodyMarkdown.trim()}\n</bai_viet_hien_tai>`;
  if (mode === "fix") {
    return [
      "Áp dụng ĐÚNG MỘT hướng dẫn sửa dưới đây lên bài viết hiện tại rồi trả về TOÀN BỘ bài đã sửa.",
      "## Hướng dẫn sửa",
      (instruction ?? "").trim(),
      "## Bài viết hiện tại",
      current,
      "## Thông tin bài",
      meta,
      "## Nguyên tắc khi sửa",
      "- Chỉ thay đổi phần liên quan trực tiếp tới hướng dẫn; giữ nguyên mọi nội dung, cấu trúc, link, số liệu khác (kể cả câu chữ) của bài.",
      "- Không rút ngắn bài trừ khi hướng dẫn yêu cầu. Không thêm lời dẫn hay ghi chú về việc đã sửa gì.",
      `- Cập nhật dòng \`*Cập nhật lần cuối: ...*\` thành ngày ${todayVi()}.`,
      writingRules(input),
    ].join("\n\n");
  }

  // rewrite
  return [
    "Viết lại bài viết hiện tại theo chỉ dẫn dưới đây (đổi giọng, rút gọn, mở rộng, đổi góc nhìn...). Trả về TOÀN BỘ bài mới hoàn chỉnh.",
    "## Chỉ dẫn viết lại",
    (instruction ?? "").trim(),
    "## Bài viết hiện tại",
    current,
    "## Thông tin bài",
    meta,
    "## Nguyên tắc khi viết lại",
    "- Giữ các sự kiện, số liệu, nguồn và internal link đúng như bài gốc trừ khi chỉ dẫn yêu cầu thay đổi.",
    "- Giữ cấu trúc heading của brief trừ khi chỉ dẫn yêu cầu đổi.",
    writingRules(input),
  ].join("\n\n");
}

/** Bỏ code fence bao toàn bài nếu model lỡ bọc (phòng hờ, không ảnh hưởng bài không bọc). */
function unfence(md: string): string {
  const m = /^```[a-zA-Z]*\s*\n([\s\S]*?)\n```\s*$/.exec(md.trim());
  return m ? m[1].trim() : md.trim();
}

/**
 * Viết bài và stream text. `onText` nhận từng delta; kết quả trả về là toàn bộ bài (đã trim).
 * Ném RefusalError nếu model từ chối; ghi AiUsage khi hoàn tất.
 */
export async function streamArticle(
  input: WriterInput,
  onText: (delta: string) => void,
): Promise<{ markdown: string; model: string }> {
  if ((input.mode === "fix" || input.mode === "rewrite") && !(input.instruction ?? "").trim()) {
    throw new Error("Chế độ sửa/viết lại cần có hướng dẫn.");
  }
  const model = MODELS.analysis;
  const stream = claude().messages.stream({
    model,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: { effort: writerEffort() },
    system: systemBlocks(input.project, input.brief),
    messages: [{ role: "user", content: userPrompt(input) }],
  });
  stream.on("text", onText);
  const msg = await stream.finalMessage();
  assertNotRefused(msg);
  await recordUsage({
    projectId: input.projectId,
    feature: input.mode === "write" ? "article_write" : "article_fix",
    model,
    usage: msg.usage,
  });
  return { markdown: unfence(textOf(msg)), model };
}
