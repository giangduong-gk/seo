import type { BadgeTone } from "@/components/ui";

/** Nhãn + tone cho trạng thái bài viết (draft | writing | review | final). */
export const STATUS_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "Nháp", tone: "neutral" },
  writing: { label: "Đang viết", tone: "info" },
  review: { label: "Chờ duyệt", tone: "warning" },
  final: { label: "Hoàn tất", tone: "success" },
};

/** Tone theo điểm: ≥80 success · ≥60 warning · còn lại danger. */
export function scoreTone(v: number): "success" | "warning" | "danger" {
  return v >= 80 ? "success" : v >= 60 ? "warning" : "danger";
}
