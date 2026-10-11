import type { ReactNode } from "react";
import s from "./content.module.css";

/** Thẻ dữ kiện ngắn (KPI): nhãn micro · giá trị · thước đo/ghi chú ở chân. `section[aria-label]` → region cho trình đọc màn hình. */
export function KpiTile({ label, value, children, foot }: { label: string; value: ReactNode; children?: ReactNode; foot?: ReactNode }) {
  return (
    <section className={s.tile} aria-label={label}>
      <div className="micro">{label}</div>
      <div className={s.tileValue}>{value}</div>
      {children}
      {foot && <div className={s.tileFoot}>{foot}</div>}
    </section>
  );
}

/** Thước 5 nấc (vd. khối lượng tìm kiếm rất thấp → rất cao). */
export function StepMeter({ value, of = 5, label }: { value: number; of?: number; label: string }) {
  return (
    <div className={s.steps5} role="meter" aria-label={label} aria-valuemin={1} aria-valuemax={of} aria-valuenow={value} style={{ gridTemplateColumns: `repeat(${of}, 1fr)` }}>
      {Array.from({ length: of }, (_, i) => <span key={i} data-on={i < value ? "" : undefined} className={i < value ? "grow-x" : undefined} />)}
    </div>
  );
}

/** Thước liên tục 0–1 (độ tin cậy, độ khó). */
export function Meter({ value, label, tone }: { value: number; label: string; tone?: "success" | "warning" | "danger" }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={s.meter} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} data-tone={tone}>
      <span className="grow-x" style={{ width: `${pct}%` }} />
    </div>
  );
}
