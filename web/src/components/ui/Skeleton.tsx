import type { CSSProperties } from "react";

/** Khối chờ shimmer (DS Skeleton): đúng hình nội dung sắp tới. `lines` → đoạn văn, dòng cuối 62%. */
export function Skeleton({ width = "100%", height = 14, radius, lines, circle, gap = 8, style }: { width?: number | string; height?: number; radius?: number; lines?: number; circle?: boolean; gap?: number; style?: CSSProperties }) {
  if (lines && lines > 1) {
    return (
      <span style={{ display: "grid", gap, width, ...style }} aria-hidden>
        {Array.from({ length: lines }, (_, i) => <span key={i} className="skeleton" style={{ height, width: i === lines - 1 ? "62%" : "100%", borderRadius: radius }} />)}
      </span>
    );
  }
  return <span className="skeleton" aria-hidden style={{ width: circle ? height : width, height, borderRadius: circle ? "50%" : radius, ...style }} />;
}
