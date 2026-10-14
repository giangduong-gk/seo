import s from "./Progress.module.css";

/** Thanh tiến trình. Thanh đầy chạy từ 0 khi xuất hiện (tắt khi prefers-reduced-motion); value=null → indeterminate. */
export function Progress({ value, label, showValue, tone = "volt", height }: { value: number | null; label?: string; showValue?: boolean; tone?: "volt" | "success" | "warning" | "danger"; height?: number }) {
  const pct = value == null ? null : Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={[s.wrap, tone !== "volt" ? s[tone] : ""].join(" ")}>
      {(label || showValue) && (
        <div className={s.head}>
          <span>{label}</span>
          {showValue && pct != null && <span className="mono">{pct}%</span>}
        </div>
      )}
      <div className={s.track} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined} style={height ? { height } : undefined}>
        <div className={[s.fill, pct == null ? s.indeterminate : s.grow].join(" ")} style={pct == null ? undefined : { width: `${pct}%` }} />
      </div>
    </div>
  );
}
