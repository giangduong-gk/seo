import type { ReactNode } from "react";
import s from "./BarList.module.css";

export type BarItem = { label: string; value: number; display?: ReactNode; sub?: ReactNode };

/**
 * Biểu đồ thanh ngang bằng div thuần: độ dài = tỉ trọng trên tổng (hoặc so với `max`), màu --chart-1..6 theo thứ tự (từ mục thứ 7: xám --fg-3),
 * số mono căn phải. `role="img"` + `aria-label` mô tả dữ liệu (tự sinh nếu không truyền `description`).
 */
export function BarList({ items, title, description, max, formatValue = (n) => String(n) }: { items: BarItem[]; title: string; description?: string; max?: number; formatValue?: (n: number) => string }) {
  const total = items.reduce((a, b) => a + b.value, 0);
  const scale = max ?? Math.max(...items.map((i) => i.value), 0);
  const pctOf = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  const auto = `${title}: ` + items.map((i) => `${i.label} ${formatValue(i.value)} (${pctOf(i.value)}%)`).join("; ");
  return (
    <div className={s.list} role="img" aria-label={description ?? auto}>
      {items.map((it, i) => {
        const w = scale > 0 ? Math.max(it.value > 0 ? 1.5 : 0, (it.value / scale) * 100) : 0;
        return (
          <div key={it.label} className={s.row} style={{ ["--bar-c" as string]: i < 6 ? `var(--chart-${i + 1})` : "var(--fg-3)", ["--i" as string]: Math.min(i, 5) }}>
            <div className={s.head}>
              <span className={s.label} title={it.label}><span className={s.dot} /><span className={s.labelText}>{it.label}</span>{it.sub && <span className={s.sub}>{it.sub}</span>}</span>
              <span className={s.value}>{it.display ?? formatValue(it.value)}<span className={s.pct}>{pctOf(it.value)}%</span></span>
            </div>
            <div className={s.track}><div className={s.bar} style={{ width: `${w}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}
