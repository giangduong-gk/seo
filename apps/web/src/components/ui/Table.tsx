import type { ReactNode } from "react";
import s from "./Table.module.css";

/**
 * Bảng dữ liệu; cuộn ngang trong khung khi hẹp. `stickyHeader` → vùng cuộn dọc cao tối đa (mặc định min(70vh, 560px), hoặc số px)
 * với hàng tiêu đề dính trên cùng. `align` căn phải các cột số (index cột → "right").
 */
export function Table({ columns, rows, minWidth, stickyHeader, align }: { columns: string[]; rows: ReactNode[][]; minWidth?: number; stickyHeader?: boolean | number; align?: Record<number, "left" | "right" | "center"> }) {
  const maxH = typeof stickyHeader === "number" ? `${stickyHeader}px` : undefined;
  return (
    <div className={[s.scroll, stickyHeader ? s.sticky : ""].join(" ")} style={maxH ? { maxHeight: maxH } : undefined} tabIndex={stickyHeader ? 0 : undefined} role={stickyHeader ? "region" : undefined} aria-label={stickyHeader ? columns.join(", ") : undefined}>
      <table className={s.table} style={minWidth ? { minWidth } : undefined}>
        <thead><tr>{columns.map((c, j) => <th key={c} scope="col" style={align?.[j] ? { textAlign: align[j] } : undefined}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j} style={align?.[j] ? { textAlign: align[j] } : undefined}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
