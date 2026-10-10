import { marked } from "marked";

/** Tiện ích Markdown dùng chung cho Writer, Scorer, JSON-LD và export. Không phụ thuộc Claude. */

export type Heading = { level: number; text: string; line: number };

export function extractHeadings(md: string): Heading[] {
  const out: Heading[] = [];
  let inFence = false;
  md.split("\n").forEach((raw, i) => {
    if (/^\s*```/.test(raw)) inFence = !inFence;
    if (inFence) return;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(raw);
    if (m) out.push({ level: m[1].length, text: m[2].trim(), line: i });
  });
  return out;
}

/** Bỏ cú pháp Markdown để đếm từ / phân tích câu. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/[*_~`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(md: string): number {
  const t = stripMarkdown(md);
  return t ? t.split(/\s+/).length : 0;
}

export function slugify(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

/** Các phần (section) theo H2: tiêu đề + nội dung thô cho tới H2 kế tiếp. */
export function splitSections(md: string): { heading: string; level: number; body: string }[] {
  const lines = md.split("\n");
  const hs = extractHeadings(md).filter((h) => h.level <= 2);
  const out: { heading: string; level: number; body: string }[] = [];
  for (let i = 0; i < hs.length; i++) {
    const start = hs[i].line + 1;
    const end = i + 1 < hs.length ? hs[i + 1].line : lines.length;
    out.push({ heading: hs[i].text, level: hs[i].level, body: lines.slice(start, end).join("\n").trim() });
  }
  return out;
}

/** FAQ: trong section có heading chứa "FAQ"/"Câu hỏi", mỗi câu hỏi là H3 hoặc dòng in đậm; câu trả lời là đoạn kế tiếp. */
export function parseFaq(md: string): { question: string; answer: string }[] {
  const sec = splitSections(md).find((s) => /faq|câu hỏi|hỏi đáp|questions/i.test(s.heading));
  if (!sec) return [];
  const out: { question: string; answer: string }[] = [];
  const lines = sec.body.split("\n");
  let q: string | null = null; let a: string[] = [];
  const flush = () => { if (q && a.join(" ").trim()) out.push({ question: q, answer: stripMarkdown(a.join("\n")) }); q = null; a = []; };
  for (const l of lines) {
    const h3 = /^###\s+(.+)$/.exec(l); const bold = /^\*\*(.+?)\*\*\s*$/.exec(l.trim());
    if (h3 || bold) { flush(); q = (h3?.[1] ?? bold?.[1] ?? "").replace(/^Q[:.]\s*/i, "").trim(); continue; }
    if (q) a.push(l);
  }
  flush();
  return out;
}

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false, gfm: true, breaks: false }) as string;
}

export function firstParagraph(md: string): string {
  const body = md.split("\n");
  let i = 0; while (i < body.length && (/^\s*$/.test(body[i]) || /^#/.test(body[i]))) i++;
  const buf: string[] = []; while (i < body.length && body[i].trim() !== "") buf.push(body[i++]);
  return stripMarkdown(buf.join(" "));
}
