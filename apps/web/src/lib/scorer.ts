import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { MODELS, RefusalError, assertNotRefused, claude, recordUsage } from "./claude";
import { extractHeadings, firstParagraph, parseFaq, slugify, splitSections, stripMarkdown, wordCount } from "./markdown";
import { projectProfilePrompt, standards2026, type ProjectProfile } from "./prompts";
import { AiScoreOutput, type ContentBrief, type ScoreCriterion, type ScoreReport } from "./schemas";

type CriterionStatus = ScoreCriterion["status"];

/**
 * SEO/GEO Scorer — hai tầng:
 *  1. Rule engine (`runRuleChecks`): thuần hàm, không tốn token, kiểm tra cấu trúc/từ khoá/độ dài.
 *  2. AI (`runAiChecks`): Claude đánh giá các tiêu chí ngữ nghĩa (answer-first, E-E-A-T, rủi ro bịa số liệu...).
 * `scoreArticle` gộp hai tầng và tính điểm theo trọng số.
 */

export type ScoreInput = {
  markdown: string;
  title: string;
  slug: string;
  metaDescription: string;
  targetKeyword: string;
  brief: ContentBrief | null;
  locale: string;
  /** Domain dự án (tuỳ chọn) — link http(s) trỏ về domain này được tính là internal. */
  domain?: string | null;
};

/* ───────────── Tiện ích chuẩn hoá tiếng Việt ───────────── */

/** NFC + lowercase + gộp khoảng trắng — dùng cho mọi so khớp văn bản. */
export function normalizeText(s: string): string {
  return (s ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Tách token chữ/số theo Unicode (giữ dấu tiếng Việt). */
export function tokenize(s: string): string[] {
  return normalizeText(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export type MatchKind = "exact" | "partial" | "none";

/** Khớp từ khoá: exact = cụm chuẩn hoá là substring; partial = ≥ 70% token của từ khoá có mặt trong văn bản. */
export function matchKeyword(text: string, keyword: string): MatchKind {
  const t = normalizeText(text);
  const k = normalizeText(keyword);
  if (!t || !k) return "none";
  if (t.includes(k)) return "exact";
  const kt = Array.from(new Set(tokenize(k)));
  if (!kt.length) return "none";
  const tt = new Set(tokenize(t));
  const hit = kt.filter((x) => tt.has(x)).length;
  return hit / kt.length >= 0.7 ? "partial" : "none";
}

function countOccurrences(text: string, phrase: string): number {
  const t = normalizeText(text);
  const p = normalizeText(phrase);
  if (!t || !p) return 0;
  let n = 0;
  let i = 0;
  while ((i = t.indexOf(p, i)) !== -1) { n++; i += p.length; }
  return n;
}

const CODE_FENCE = /```[\s\S]*?```/g;
const MD_IMAGE = /!\[([^\]]*)\]\(([^)]*)\)/g;
const MD_LINK = /(?<!!)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const FAQ_HEADING = /faq|câu hỏi|hỏi đáp|questions/i;
const SOURCE_MARKER = /〈link〉|https?:\/\//i;
const SOURCE_MARKER_TEXT = /\(nguồn|\bnguồn\b|\btheo\s+(?!dõi|đó|như|cách|kiểu|từng|mình|bạn|tôi|em|anh|chị)|cần kiểm chứng/iu;
const TABLE_SEP = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/m;
const LIST_LINE = /^\s{0,3}(?:[-*+]|\d+[.)])\s+\S/m;
const UPDATED_LINE = /cập nhật( lần cuối)?|last updated/i;

type Link = { text: string; href: string };

function extractLinks(md: string): Link[] {
  const body = md.replace(CODE_FENCE, " ");
  const out: Link[] = [];
  for (const m of body.matchAll(MD_LINK)) out.push({ text: m[1], href: m[2].trim() });
  return out;
}

function hostOf(href: string): string | null {
  try { return new URL(href).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

function isInternalLink(href: string, domain?: string | null): boolean {
  const h = href.trim();
  if (!h || h.startsWith("#") || /^(mailto|tel|javascript):/i.test(h)) return false;
  if (/^https?:\/\//i.test(h) || h.startsWith("//")) {
    if (!domain) return false;
    const host = hostOf(h.startsWith("//") ? `https:${h}` : h);
    const d = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").toLowerCase().split("/")[0];
    return Boolean(host && (host === d || host.endsWith(`.${d}`)));
  }
  return true; // đường dẫn tương đối hoặc bắt đầu bằng "/"
}

function isExternalLink(href: string, domain?: string | null): boolean {
  const h = href.trim();
  if (!/^https?:\/\//i.test(h)) return false;
  return !isInternalLink(h, domain);
}

/** Chia câu trên văn bản đã bỏ Markdown. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => tokenize(s).length > 0);
}

/* ───────────── Rule engine ───────────── */

type RuleDef = { id: string; group: "seo" | "geo"; label: string; weight: number };

const RULES = {
  "kw-in-title": { id: "kw-in-title", group: "seo", label: "Từ khoá trong title", weight: 5 },
  "kw-in-h1": { id: "kw-in-h1", group: "seo", label: "Từ khoá trong H1", weight: 4 },
  "kw-in-intro": { id: "kw-in-intro", group: "seo", label: "Từ khoá trong 100 từ đầu", weight: 4 },
  "kw-in-meta": { id: "kw-in-meta", group: "seo", label: "Từ khoá trong meta description", weight: 3 },
  "kw-in-slug": { id: "kw-in-slug", group: "seo", label: "Từ khoá trong slug", weight: 2 },
  "title-length": { id: "title-length", group: "seo", label: "Độ dài title", weight: 2 },
  "meta-length": { id: "meta-length", group: "seo", label: "Độ dài meta description", weight: 2 },
  "single-h1": { id: "single-h1", group: "seo", label: "Đúng một H1", weight: 3 },
  "heading-hierarchy": { id: "heading-hierarchy", group: "seo", label: "Cấu trúc heading hợp lý", weight: 2 },
  "word-count": { id: "word-count", group: "seo", label: "Độ dài bài viết", weight: 3 },
  "semantic-coverage": { id: "semantic-coverage", group: "seo", label: "Độ phủ ngữ nghĩa", weight: 4 },
  "keyword-density": { id: "keyword-density", group: "seo", label: "Mật độ từ khoá", weight: 2 },
  "internal-links": { id: "internal-links", group: "seo", label: "Internal link", weight: 2 },
  "external-links": { id: "external-links", group: "seo", label: "External link", weight: 1 },
  "images-alt": { id: "images-alt", group: "seo", label: "Hình ảnh có alt", weight: 2 },
  "has-table": { id: "has-table", group: "geo", label: "Có bảng tóm tắt/so sánh", weight: 2 },
  "has-list": { id: "has-list", group: "geo", label: "Có danh sách/bước", weight: 1 },
  "has-faq": { id: "has-faq", group: "geo", label: "Có mục FAQ", weight: 3 },
  "updated-line": { id: "updated-line", group: "geo", label: "Dòng ngày cập nhật", weight: 3 },
  "answer-first": { id: "answer-first", group: "geo", label: "Trả lời trực tiếp đầu mỗi mục", weight: 4 },
  "sentence-length": { id: "sentence-length", group: "geo", label: "Câu ngắn, dễ trích dẫn", weight: 2 },
  "citations": { id: "citations", group: "geo", label: "Dẫn nguồn", weight: 3 },
  "unverified-numbers": { id: "unverified-numbers", group: "geo", label: "Số liệu có nguồn", weight: 2 },
} as const satisfies Record<string, RuleDef>;

export type RuleId = keyof typeof RULES;

/** Danh sách id của mọi tiêu chí rule — dùng cho test. */
export const RULE_IDS: readonly string[] = Object.keys(RULES);

function rule(id: RuleId, status: CriterionStatus, reason: string, fix = ""): ScoreCriterion {
  const d = RULES[id];
  return { id: d.id, group: d.group, label: d.label, status, reason, fix: status === "pass" ? "" : fix, source: "rule", weight: d.weight };
}

function charLen(s: string): number {
  return Array.from(s ?? "").length;
}

function kwPresence(id: RuleId, where: string, text: string, kw: string, fixHint: string): ScoreCriterion {
  const m = matchKeyword(text, kw);
  if (m === "exact") return rule(id, "pass", `${where} chứa đúng cụm "${kw}".`);
  if (m === "partial") return rule(id, "warn", `${where} chỉ chứa một phần token của "${kw}", chưa có đúng cụm.`, `${fixHint}: đưa nguyên cụm "${kw}" vào ${where.toLowerCase()} một cách tự nhiên.`);
  return rule(id, "fail", `${where} không chứa từ khoá "${kw}".`, `${fixHint}: thêm cụm "${kw}" vào ${where.toLowerCase()}.`);
}

/** Chạy toàn bộ tiêu chí rule — thuần hàm, không gọi AI. */
export function runRuleChecks(input: ScoreInput): ScoreCriterion[] {
  const md = input.markdown ?? "";
  const kw = input.targetKeyword ?? "";
  const brief = input.brief;
  const out: ScoreCriterion[] = [];
  const headings = extractHeadings(md);
  const h1s = headings.filter((h) => h.level === 1);
  const lines = md.split("\n");
  const plain = stripMarkdown(md);
  const words = wordCount(md);

  /* ── Từ khoá ở các vị trí quan trọng ── */
  out.push(kwPresence("kw-in-title", "Title", input.title, kw, "Sửa title"));

  if (h1s.length === 0) out.push(rule("kw-in-h1", "fail", "Bài không có H1.", `Thêm một H1 duy nhất ở đầu bài có chứa "${kw}".`));
  else out.push(kwPresence("kw-in-h1", "H1", h1s[0].text, kw, "Sửa H1"));

  {
    const start = h1s.length ? h1s[0].line + 1 : 0;
    const intro = stripMarkdown(lines.slice(start).join("\n")).split(/\s+/).slice(0, 100).join(" ");
    out.push(kwPresence("kw-in-intro", "100 từ mở đầu", intro, kw, "Viết lại đoạn mở đầu"));
  }

  if (!input.metaDescription?.trim()) out.push(rule("kw-in-meta", "fail", "Meta description trống.", `Viết meta description 120–155 ký tự có chứa "${kw}".`));
  else out.push(kwPresence("kw-in-meta", "Meta description", input.metaDescription, kw, "Sửa meta description"));

  {
    const kt = Array.from(new Set(slugify(kw).split("-").filter(Boolean)));
    const st = new Set((input.slug || "").toLowerCase().split("-").filter(Boolean));
    const ratio = kt.length ? kt.filter((t) => st.has(t)).length / kt.length : 0;
    const pct = Math.round(ratio * 100);
    if (ratio >= 0.6) out.push(rule("kw-in-slug", "pass", `Slug "/${input.slug}" chứa ${pct}% token từ khoá.`));
    else if (ratio >= 0.3) out.push(rule("kw-in-slug", "warn", `Slug "/${input.slug}" chỉ chứa ${pct}% token từ khoá.`, `Đổi slug thành dạng ngắn gọn chứa từ khoá, ví dụ "/${slugify(kw)}".`));
    else out.push(rule("kw-in-slug", "fail", `Slug "/${input.slug}" gần như không chứa từ khoá (${pct}%).`, `Đổi slug thành "/${slugify(kw)}" hoặc tương đương.`));
  }

  /* ── Độ dài title / meta ── */
  {
    const n = charLen(input.title);
    if (n <= 60) out.push(rule("title-length", "pass", `Title dài ${n} ký tự (≤ 60).`));
    else if (n <= 70) out.push(rule("title-length", "warn", `Title dài ${n} ký tự, có thể bị cắt trên SERP.`, "Rút title xuống ≤ 60 ký tự, giữ từ khoá ở đầu."));
    else out.push(rule("title-length", "fail", `Title dài ${n} ký tự (> 70), sẽ bị cắt trên SERP.`, "Viết lại title ≤ 60 ký tự, từ khoá đứng trước, bỏ từ thừa."));
  }
  {
    const n = charLen(input.metaDescription ?? "");
    if (n === 0) out.push(rule("meta-length", "fail", "Meta description trống.", "Viết meta description 120–155 ký tự, có từ khoá và lợi ích cụ thể."));
    else if (n >= 120 && n <= 155) out.push(rule("meta-length", "pass", `Meta description dài ${n} ký tự (120–155).`));
    else if (n >= 80 && n <= 170) out.push(rule("meta-length", "warn", `Meta description dài ${n} ký tự, ngoài khoảng tối ưu 120–155.`, n < 120 ? "Bổ sung meta description lên 120–155 ký tự, thêm lợi ích/số liệu cụ thể." : "Rút meta description xuống 120–155 ký tự."));
    else out.push(rule("meta-length", "fail", `Meta description dài ${n} ký tự, quá ${n < 80 ? "ngắn" : "dài"}.`, "Viết lại meta description 120–155 ký tự, có từ khoá và lời kêu gọi hành động."));
  }

  /* ── Cấu trúc heading ── */
  if (h1s.length === 1) out.push(rule("single-h1", "pass", "Bài có đúng một H1."));
  else if (h1s.length === 0) out.push(rule("single-h1", "fail", "Bài không có H1.", "Thêm một H1 duy nhất ở đầu bài (dòng `# ...`)."));
  else out.push(rule("single-h1", "fail", `Bài có ${h1s.length} H1: ${h1s.map((h) => `"${h.text}"`).join(", ")}.`, "Giữ một H1 duy nhất, hạ các H1 còn lại xuống H2."));

  {
    const skips: string[] = [];
    let prev = 0;
    for (const h of headings) {
      if (prev > 0 && h.level > prev + 1) skips.push(`H${prev}→H${h.level} tại "${h.text}"`);
      prev = h.level;
    }
    const h2 = headings.filter((h) => h.level === 2).length;
    if (skips.length) out.push(rule("heading-hierarchy", "fail", `Nhảy cấp heading: ${skips.slice(0, 4).join("; ")}.`, "Sửa heading để không nhảy cấp (H2 → H3 → H4), mỗi cấp con nằm trong cấp cha."));
    else if (h2 >= 3) out.push(rule("heading-hierarchy", "pass", `Không nhảy cấp, có ${h2} H2.`));
    else if (h2 >= 1) out.push(rule("heading-hierarchy", "warn", `Chỉ có ${h2} H2 (cần ≥ 3).`, "Chia bài thành ≥ 3 mục H2, mỗi mục trả lời một câu hỏi/nhu cầu riêng."));
    else out.push(rule("heading-hierarchy", "fail", "Bài không có H2 nào.", "Thêm ≥ 3 mục H2 dạng câu hỏi/nhu cầu để chia cấu trúc bài."));
  }

  /* ── Độ dài bài ── */
  if (brief && brief.wordCountMin > 0 && brief.wordCountMax >= brief.wordCountMin) {
    const { wordCountMin: min, wordCountMax: max } = brief;
    if (words >= min && words <= max) out.push(rule("word-count", "pass", `Bài dài ${words} từ, trong khoảng brief ${min}–${max}.`));
    else if (words >= min * 0.8 && words <= max * 1.2) out.push(rule("word-count", "warn", `Bài dài ${words} từ, lệch nhẹ khỏi khoảng brief ${min}–${max}.`, words < min ? `Bổ sung nội dung lên ít nhất ${min} từ (thêm ví dụ, số liệu, bước cụ thể).` : `Rút gọn bài xuống tối đa ${max} từ, bỏ đoạn lặp ý.`));
    else out.push(rule("word-count", "fail", `Bài dài ${words} từ, ngoài khoảng brief ${min}–${max} quá 20%.`, words < min ? `Viết thêm để đạt ${min}–${max} từ theo outline của brief.` : `Cắt bớt để còn ${min}–${max} từ, tách phần thừa thành bài khác.`));
  } else if (words >= 800) out.push(rule("word-count", "pass", `Bài dài ${words} từ (≥ 800).`));
  else if (words >= 500) out.push(rule("word-count", "warn", `Bài dài ${words} từ, hơi ngắn (< 800).`, "Bổ sung nội dung lên ≥ 800 từ: thêm ví dụ, bảng, bước thực hiện."));
  else out.push(rule("word-count", "fail", `Bài chỉ có ${words} từ (< 500).`, "Viết thêm để đạt ≥ 800 từ, bao phủ đủ các mục H2 trong outline."));

  /* ── Độ phủ ngữ nghĩa ── */
  {
    const termsRaw: string[] = brief
      ? [brief.targetKeyword, ...brief.outline.flatMap((o) => o.keywords)]
      : tokenize(kw).filter((t) => t.length >= 2);
    const seen = new Set<string>();
    const terms = termsRaw.map((t) => normalizeText(t)).filter((t) => t && !seen.has(t) && (seen.add(t), true));
    const missing: string[] = [];
    let score = 0;
    for (const t of terms) {
      const m = matchKeyword(plain, t);
      if (m === "exact") score += 1;
      else { if (m === "partial") score += 0.5; missing.push(t); }
    }
    const ratio = terms.length ? score / terms.length : 0;
    const pct = Math.round(ratio * 100);
    const miss = missing.slice(0, 8).map((t) => `"${t}"`).join(", ");
    if (!terms.length) out.push(rule("semantic-coverage", "warn", "Không có danh sách từ khoá ngữ nghĩa để đối chiếu.", "Bổ sung các từ khoá phụ/thực thể liên quan vào bài."));
    else if (ratio >= 0.7) out.push(rule("semantic-coverage", "pass", `Phủ ${pct}% cụm ngữ nghĩa (${terms.length} cụm).${missing.length ? ` Thiếu: ${miss}.` : ""}`));
    else if (ratio >= 0.4) out.push(rule("semantic-coverage", "warn", `Chỉ phủ ${pct}% cụm ngữ nghĩa. Thiếu: ${miss}.`, `Bổ sung tự nhiên các cụm: ${miss} vào các mục H2 phù hợp.`));
    else out.push(rule("semantic-coverage", "fail", `Phủ ${pct}% cụm ngữ nghĩa, quá thấp. Thiếu: ${miss}.`, `Viết thêm nội dung bao phủ các cụm: ${miss}, mỗi cụm ít nhất một đoạn hoặc một dòng trong bảng.`));
  }

  /* ── Mật độ từ khoá ── */
  {
    const occ = countOccurrences(plain, kw);
    const kt = tokenize(kw).length;
    const density = words > 0 ? (occ * kt * 100) / words : 0;
    const d = density.toFixed(2);
    if (density >= 0.5 && density <= 2.5) out.push(rule("keyword-density", "pass", `Mật độ ${d}% (${occ} lần / ${words} từ).`));
    else if (density >= 0.3 && density <= 3.5) out.push(rule("keyword-density", "warn", `Mật độ ${d}% (${occ} lần), ${density < 0.5 ? "hơi thấp" : "hơi cao"}.`, density < 0.5 ? `Nhắc "${kw}" thêm 1–2 lần ở các mục H2 chính.` : `Bớt lặp "${kw}", thay bằng biến thể hoặc đại từ.`));
    else out.push(rule("keyword-density", "fail", `Mật độ ${d}% (${occ} lần / ${words} từ): ${density < 0.3 ? "quá thấp" : "nhồi từ khoá"}.`, density < 0.3 ? `Đưa "${kw}" vào mở bài, 1–2 H2 và kết bài (mục tiêu 0.5–2.5%).` : `Giảm số lần lặp "${kw}" xuống khoảng 1% số từ, dùng biến thể tự nhiên.`));
  }

  /* ── Link ── */
  {
    const links = extractLinks(md);
    const internal = links.filter((l) => isInternalLink(l.href, input.domain)).length;
    const external = links.filter((l) => isExternalLink(l.href, input.domain)).length;
    if (internal >= 2) out.push(rule("internal-links", "pass", `Có ${internal} internal link.`));
    else if (internal === 1) out.push(rule("internal-links", "warn", "Chỉ có 1 internal link.", "Thêm ít nhất 1 internal link nữa tới bài liên quan trong cluster, anchor mô tả rõ."));
    else out.push(rule("internal-links", "fail", "Không có internal link.", "Thêm ≥ 2 internal link (đường dẫn tương đối, ví dụ /bai-lien-quan) tới các bài trong cluster với anchor mô tả."));
    if (external >= 1) out.push(rule("external-links", "pass", `Có ${external} external link.`));
    else out.push(rule("external-links", "warn", "Không có external link tới nguồn ngoài.", "Thêm ≥ 1 link http(s) tới nguồn uy tín (nhà sản xuất, cơ quan, báo cáo) cho số liệu trong bài."));
  }

  /* ── Hình ảnh ── */
  {
    const imgs = Array.from(md.replace(CODE_FENCE, " ").matchAll(MD_IMAGE)).map((m) => m[1].trim());
    const noAlt = imgs.filter((a) => !a).length;
    if (!imgs.length) out.push(rule("images-alt", "warn", "Bài không có hình ảnh.", "Thêm ≥ 1 hình/infographic/bảng ảnh với alt mô tả có từ khoá."));
    else if (noAlt) out.push(rule("images-alt", "fail", `${noAlt}/${imgs.length} hình thiếu alt.`, "Điền alt mô tả nội dung cho mọi hình (![mô tả](url))."));
    else out.push(rule("images-alt", "pass", `${imgs.length} hình đều có alt.`));
  }

  /* ── GEO: định dạng ── */
  const body = md.replace(CODE_FENCE, " ");
  if (TABLE_SEP.test(body)) out.push(rule("has-table", "pass", "Bài có bảng (GFM table)."));
  else out.push(rule("has-table", "fail", "Bài không có bảng tóm tắt/so sánh.", "Thêm một bảng Markdown tóm tắt số liệu/so sánh chính (ví dụ bảng chi phí, bảng so sánh lựa chọn)."));
  if (LIST_LINE.test(body)) out.push(rule("has-list", "pass", "Bài có danh sách bullet/bước."));
  else out.push(rule("has-list", "fail", "Bài không có danh sách.", "Chuyển các bước/điều kiện thành danh sách đánh số hoặc bullet."));

  {
    const faq = parseFaq(md);
    if (faq.length >= 3) out.push(rule("has-faq", "pass", `Mục FAQ có ${faq.length} câu hỏi.`));
    else if (faq.length >= 1) out.push(rule("has-faq", "warn", `Mục FAQ chỉ có ${faq.length} câu hỏi.`, "Bổ sung FAQ lên ≥ 3 câu hỏi (H3 hoặc dòng in đậm), mỗi câu trả lời 1–3 câu answer-first."));
    else out.push(rule("has-faq", "fail", "Không có mục FAQ.", "Thêm mục `## Câu hỏi thường gặp` với ≥ 3 câu hỏi dạng H3 và câu trả lời ngắn gọn."));
  }

  {
    const head = lines.slice(0, 15).join("\n");
    if (UPDATED_LINE.test(head)) out.push(rule("updated-line", "pass", "Có dòng ngày cập nhật trong 15 dòng đầu."));
    else out.push(rule("updated-line", "fail", "Không thấy dòng \"Cập nhật lần cuối\" ở đầu bài.", "Thêm ngay dưới H1 dòng: *Cập nhật lần cuối: DD/MM/YYYY* (kèm tác giả nếu có)."));
  }

  /* ── GEO: answer-first (proxy bằng rule) ── */
  {
    const sections = splitSections(md).filter((s) => s.level === 2 && !FAQ_HEADING.test(s.heading));
    if (!sections.length) out.push(rule("answer-first", "fail", "Không có mục H2 để đánh giá.", "Chia bài thành các mục H2, mỗi mục mở bằng 1–2 câu trả lời trực tiếp."));
    else {
      const bad: string[] = [];
      for (const s of sections) {
        const p = firstParagraph(s.body);
        const n = p ? p.split(/\s+/).length : 0;
        if (!p || n > 60) bad.push(`"${s.heading}"${n > 60 ? ` (${n} từ)` : " (trống)"}`);
      }
      const ok = sections.length - bad.length;
      const ratio = ok / sections.length;
      const list = bad.slice(0, 6).join(", ");
      if (ratio >= 0.8) out.push(rule("answer-first", "pass", `${ok}/${sections.length} mục H2 mở bằng đoạn ngắn ≤ 60 từ.${bad.length ? ` Cần xem: ${list}.` : ""}`));
      else if (ratio >= 0.5) out.push(rule("answer-first", "warn", `Chỉ ${ok}/${sections.length} mục H2 mở bằng đoạn ngắn. Mục cần sửa: ${list}.`, `Với các mục ${list}: thêm 1–2 câu trả lời trực tiếp (≤ 60 từ) ngay dưới heading, rồi mới giải thích.`));
      else out.push(rule("answer-first", "fail", `Chỉ ${ok}/${sections.length} mục H2 mở bằng đoạn ngắn. Mục cần sửa: ${list}.`, `Viết lại phần mở đầu của các mục ${list}: câu đầu tiên là câu trả lời có số liệu, ≤ 60 từ.`));
    }
  }

  /* ── GEO: độ dài câu ── */
  {
    const sents = splitSentences(plain);
    const avg = sents.length ? sents.reduce((a, s) => a + tokenize(s).length, 0) / sents.length : 0;
    const a = avg.toFixed(1);
    if (!sents.length) out.push(rule("sentence-length", "fail", "Không có câu nào để đánh giá.", "Viết nội dung bài."));
    else if (avg <= 22) out.push(rule("sentence-length", "pass", `Trung bình ${a} từ/câu (${sents.length} câu).`));
    else if (avg <= 28) out.push(rule("sentence-length", "warn", `Trung bình ${a} từ/câu, hơi dài.`, "Tách các câu > 25 từ thành 2 câu; mỗi câu một ý để AI dễ trích dẫn."));
    else out.push(rule("sentence-length", "fail", `Trung bình ${a} từ/câu, quá dài.`, "Viết lại với câu ≤ 20 từ, dùng bullet cho liệt kê."));
  }

  /* ── GEO: dẫn nguồn & số liệu ── */
  // Giữ dấu vết link (〈link〉) và bỏ các dòng bảng — ô bảng không phải câu văn.
  const linked = body
    .split("\n").filter((l) => !/^\s*\|/.test(l)).join("\n")
    .replace(MD_IMAGE, " ").replace(MD_LINK, "$1 〈link〉");
  const plainLinked = stripMarkdown(linked);
  {
    const httpLinks = extractLinks(md).filter((l) => /^https?:\/\//i.test(l.href)).length;
    const bare = (plain.match(/https?:\/\/\S+/g) ?? []).length;
    const markers = (plain.match(/\(nguồn/gi) ?? []).length + (plain.match(/\btheo\s+(?!dõi|đó|như|cách|kiểu|từng|mình|bạn|tôi|em|anh|chị)/giu) ?? []).length;
    const n = httpLinks + bare + markers;
    if (n >= 2) out.push(rule("citations", "pass", `Có ${n} tín hiệu dẫn nguồn (link http(s), "nguồn", "theo ...").`));
    else if (n === 1) out.push(rule("citations", "warn", "Chỉ có 1 tín hiệu dẫn nguồn.", "Thêm ≥ 1 nguồn nữa: link tới nguồn gốc hoặc ghi \"(Nguồn: ..., năm)\" sau số liệu."));
    else out.push(rule("citations", "fail", "Không có dẫn nguồn nào.", "Bổ sung ≥ 2 nguồn uy tín cho các số liệu/quy định trong bài, dạng link hoặc \"(Nguồn: ...)\"."));
  }
  {
    const sents = splitSentences(plainLinked);
    const numeric = sents.filter((s) => /\d/.test(s));
    const sourced = numeric.filter((s) => SOURCE_MARKER.test(s) || SOURCE_MARKER_TEXT.test(s));
    if (numeric.length < 5) out.push(rule("unverified-numbers", "pass", `Chỉ ${numeric.length} câu có số liệu, chưa đủ để đánh giá rủi ro.`));
    else {
      const ratio = sourced.length / numeric.length;
      const pct = Math.round(ratio * 100);
      if (ratio >= 0.3) out.push(rule("unverified-numbers", "pass", `${sourced.length}/${numeric.length} câu có số liệu kèm dấu hiệu nguồn (${pct}%).`));
      else out.push(rule("unverified-numbers", "warn", `Chỉ ${sourced.length}/${numeric.length} câu có số liệu kèm nguồn (${pct}%).`, "Với mỗi số liệu quan trọng: thêm nguồn + năm (\"theo Apple, 2026\" hoặc link), hoặc đánh dấu \"(cần kiểm chứng)\" nếu chưa chắc."));
    }
  }

  return out;
}

/* ───────────── AI checks ───────────── */

const AI_META: Record<AiScoreOutput["criteria"][number]["id"], { label: string; weight: number }> = {
  "answer-first": { label: "Trả lời trực tiếp đầu mỗi mục", weight: 5 },
  citability: { label: "Câu trích dẫn độc lập, có số liệu/nguồn", weight: 5 },
  "eeat-signals": { label: "Tín hiệu E-E-A-T", weight: 4 },
  "entity-clarity": { label: "Thực thể được định nghĩa rõ", weight: 3 },
  freshness: { label: "Độ mới và tín hiệu cập nhật", weight: 3 },
  "machine-readability": { label: "Dễ đọc cho máy", weight: 3 },
  "hallucination-risk": { label: "Rủi ro số liệu/nguồn bịa", weight: 5 },
  "intent-match": { label: "Khớp ý định tìm kiếm", weight: 4 },
};

export const AI_IDS: readonly string[] = Object.keys(AI_META);

const MAX_ARTICLE_CHARS = 60_000;

function systemBlocks(project: ProjectProfile): Anthropic.TextBlockParam[] {
  return [
    { type: "text", text: standards2026(), cache_control: { type: "ephemeral" } },
    { type: "text", text: projectProfilePrompt(project), cache_control: { type: "ephemeral" } },
  ];
}

function briefSummary(b: ContentBrief): string {
  const outline = b.outline.map((o) => `${"  ".repeat(Math.max(0, o.level - 1))}H${o.level}: ${o.heading}`).join("\n");
  return [
    `- Tiêu đề brief: ${b.title}`,
    `- Từ khoá mục tiêu: ${b.targetKeyword}`,
    `- Ý định: ${b.intent}`,
    `- Đối tượng: ${b.audience}`,
    `- Góc viết: ${b.angle}`,
    `- Outline:\n${outline}`,
    b.geoChecklist.length ? `- Checklist GEO: ${b.geoChecklist.map((g) => `[${g.priority}] ${g.label}`).join("; ")}` : null,
  ].filter(Boolean).join("\n");
}

/** Gọi Claude chấm 8 tiêu chí ngữ nghĩa (GEO/E-E-A-T). Ném lỗi nếu API lỗi hoặc model từ chối. */
export async function runAiChecks(project: ProjectProfile, input: ScoreInput, projectId?: string): Promise<{ criteria: ScoreCriterion[]; summary: string; model: string }> {
  const model = MODELS.bulk;
  let article = input.markdown ?? "";
  let truncNote = "";
  if (article.length > MAX_ARTICLE_CHARS) {
    article = article.slice(0, MAX_ARTICLE_CHARS);
    truncNote = `\n\n[Bài đã bị cắt ở ${MAX_ARTICLE_CHARS.toLocaleString("vi-VN")} ký tự để chấm — đánh giá trên phần đã có.]`;
  }

  const parts: string[] = [
    `Chấm bài viết sau theo bộ tiêu chuẩn 2026. Từ khoá mục tiêu: "${input.targetKeyword}". Ngôn ngữ: ${input.locale}.`,
    `## Metadata\n- Title: ${input.title}\n- Slug: /${input.slug}\n- Meta description: ${input.metaDescription || "(trống)"}`,
  ];
  if (input.brief) parts.push(`## Tóm tắt brief\n${briefSummary(input.brief)}`);
  else parts.push("## Brief\nKhông có brief — đánh giá intent-match dựa trên từ khoá mục tiêu.");
  parts.push(
    "## Yêu cầu\n" +
      `Đánh giá ĐÚNG 8 tiêu chí, mỗi id xuất hiện một lần: ${AI_IDS.join(", ")}.\n` +
      "- answer-first: mỗi H2 mở bằng câu trả lời trực tiếp 1–2 câu trước khi giải thích.\n" +
      "- citability: có câu đứng riêng vẫn đúng và đủ nghĩa, kèm số liệu/nguồn, AI có thể trích dẫn nguyên văn.\n" +
      "- eeat-signals: tác giả/chức danh, kinh nghiệm thực tế, bằng chứng, minh bạch phương pháp/giới hạn.\n" +
      "- entity-clarity: thực thể chính (sản phẩm, tổ chức, khái niệm) được định nghĩa rõ ngay phần đầu.\n" +
      "- freshness: ngày cập nhật, dữ liệu/quy định mới, dấu hiệu nội dung còn hiệu lực.\n" +
      "- machine-readability: cấu trúc heading dạng câu hỏi, bullet, bảng, định nghĩa in đậm, bước đánh số.\n" +
      "- hallucination-risk: số liệu/nguồn/tên có vẻ bịa, không kiểm chứng được, mâu thuẫn nội bộ — pass = rủi ro thấp.\n" +
      "- intent-match: bài khớp ý định tìm kiếm và đối tượng trong brief/từ khoá.\n" +
      "Mỗi tiêu chí: status pass/warn/fail; reason có trích dẫn ngắn nguyên văn từ bài làm bằng chứng (đặt trong ngoặc kép); " +
      "fix là chỉ dẫn cụ thể, có thể giao thẳng cho Writer thực hiện (nêu mục nào, sửa gì, ví dụ câu nên viết); fix để chuỗi rỗng nếu pass. " +
      "summary 2–3 câu nhận xét tổng thể. Viết bằng tiếng Việt.",
    `## Bài viết (Markdown)\n${article}${truncNote}`,
  );

  const res = await claude().messages.stream({
    model,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(AiScoreOutput) },
    system: systemBlocks(project),
    messages: [{ role: "user", content: parts.join("\n\n") }],
  }).finalMessage();
  assertNotRefused(res);
  await recordUsage({ projectId, feature: "article_score", model, usage: res.usage });
  if (!res.parsed_output) throw new Error("Không parse được kết quả chấm điểm từ model.");

  const seen = new Set<string>();
  const criteria: ScoreCriterion[] = [];
  for (const c of res.parsed_output.criteria) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    const meta = AI_META[c.id];
    criteria.push({ id: c.id, group: "geo", label: meta.label, status: c.status, reason: c.reason, fix: c.status === "pass" ? "" : c.fix, source: "ai", weight: meta.weight });
  }
  return { criteria, summary: res.parsed_output.summary, model };
}

/* ───────────── Tính điểm ───────────── */

const STATUS_SCORE: Record<CriterionStatus, number> = { pass: 1, warn: 0.5, fail: 0 };

/** Điểm theo nhóm: trung bình có trọng số (pass=1, warn=0.5, fail=0), làm tròn 0–100; nhóm không có tiêu chí → 0. */
export function computeScores(criteria: ScoreCriterion[]): { seoScore: number; geoScore: number } {
  const calc = (group: "seo" | "geo") => {
    const list = criteria.filter((c) => c.group === group);
    const total = list.reduce((a, c) => a + c.weight, 0);
    if (!total) return 0;
    const got = list.reduce((a, c) => a + c.weight * STATUS_SCORE[c.status], 0);
    return Math.max(0, Math.min(100, Math.round((got / total) * 100)));
  };
  return { seoScore: calc("seo"), geoScore: calc("geo") };
}

function ruleSummary(criteria: ScoreCriterion[], note?: string): string {
  const fails = criteria.filter((c) => c.status === "fail");
  const warns = criteria.filter((c) => c.status === "warn");
  const pass = criteria.length - fails.length - warns.length;
  const top = fails.sort((a, b) => b.weight - a.weight).slice(0, 4).map((c) => c.label).join(", ");
  return [
    `Chấm theo quy tắc${note ? ` (${note})` : ""}: ${pass}/${criteria.length} tiêu chí đạt, ${warns.length} cần cải thiện, ${fails.length} chưa đạt.`,
    fails.length ? `Ưu tiên sửa: ${top}.` : "Không có tiêu chí nào chưa đạt.",
  ].join(" ");
}

/** Chấm bài: rule luôn chạy; AI chạy khi withAi và có API key. AI lỗi (không phải từ chối) → ghi warn, tiếp tục với rule. */
export async function scoreArticle(project: ProjectProfile, input: ScoreInput, opts: { withAi: boolean; projectId?: string }): Promise<ScoreReport> {
  const rules = runRuleChecks(input);
  const useAi = opts.withAi && Boolean(process.env.ANTHROPIC_API_KEY);

  if (!useAi) {
    const note = opts.withAi ? "chưa cấu hình ANTHROPIC_API_KEY nên không chấm bằng AI" : "không dùng AI";
    return { ...computeScores(rules), criteria: rules, summary: ruleSummary(rules, note), model: null };
  }

  try {
    const ai = await runAiChecks(project, input, opts.projectId);
    const aiIds = new Set(ai.criteria.map((c) => c.id));
    const merged = [...rules.filter((c) => !aiIds.has(c.id)), ...ai.criteria];
    return { ...computeScores(merged), criteria: merged, summary: ai.summary, model: ai.model };
  } catch (err) {
    if (err instanceof RefusalError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[scorer] Chấm bằng AI thất bại, dùng rule:", msg);
    return { ...computeScores(rules), criteria: rules, summary: ruleSummary(rules, `AI lỗi: ${msg.slice(0, 160)}`), model: null };
  }
}
