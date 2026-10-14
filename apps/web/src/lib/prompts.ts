import { readFileSync } from "node:fs";
import path from "node:path";
import type { EntityProfile } from "./schemas";

let cachedStandards: string | null = null;

/** Nội dung bộ tiêu chuẩn 2026 — ổn định, đặt đầu system prompt để cache. */
export function standards2026(): string {
  if (cachedStandards) return cachedStandards;
  cachedStandards = readFileSync(path.join(process.cwd(), "prompts", "standards-2026.md"), "utf8");
  return cachedStandards;
}

export type ProjectProfile = {
  name: string;
  domain?: string | null;
  industry?: string | null;
  locale: string;
  brandVoice?: string | null;
  entityProfile?: EntityProfile | null;
};

/** Hồ sơ dự án — thay đổi ít, đặt sau standards, trước nội dung biến thiên. */
export function projectProfilePrompt(p: ProjectProfile): string {
  const e = p.entityProfile ?? {};
  return [
    "# Hồ sơ dự án",
    `- Tên: ${p.name}`,
    p.domain ? `- Domain: ${p.domain}` : null,
    p.industry ? `- Ngành: ${p.industry}` : null,
    `- Ngôn ngữ/thị trường: ${p.locale}`,
    p.brandVoice ? `- Giọng văn thương hiệu: ${p.brandVoice}` : null,
    e.organization ? `- Tổ chức: ${e.organization}` : null,
    e.products?.length ? `- Sản phẩm/dịch vụ: ${e.products.join(", ")}` : null,
    e.authors?.length ? `- Tác giả/chuyên gia: ${e.authors.join(", ")}` : null,
    e.sameAs?.length ? `- sameAs: ${e.sameAs.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
