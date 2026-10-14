import { existsSync } from "node:fs";
import path from "node:path";
import { describe } from "vitest";

/** Thư mục gốc của app (apps/web/) — vitest chạy với cwd = apps/web, nhưng tính từ file này cho chắc. */
export const WEB_ROOT = path.resolve(__dirname, "..", "..");

/**
 * Import một module có thể chưa tồn tại (Sprint đang viết song song).
 * - Nếu file chưa có → trả về null để test `describe.skip` thay vì làm fail cả suite.
 * - Nếu file có nhưng import lỗi → ném lỗi (đó là bug thật, phải fail).
 */
export async function importIfExists<T>(relFromWebRoot: string): Promise<T | null> {
  const abs = path.join(WEB_ROOT, relFromWebRoot);
  if (!existsSync(abs)) return null;
  return (await import(/* @vite-ignore */ abs)) as T;
}

/** `describe` hoặc `describe.skip` kèm lý do rõ ràng khi module chưa có. */
export function describeIfModule(name: string, mod: unknown, relPath: string, body: () => void) {
  if (mod) describe(name, body);
  else describe.skip(`${name} — SKIPPED: ${relPath} chưa tồn tại (Sprint 3 đang viết song song)`, body);
}
