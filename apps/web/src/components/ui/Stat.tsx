import type { ReactNode } from "react";
import s from "./Stat.module.css";

/**
 * Ô KPI gọn (thay cho Panel có header khi chỉ cần một con số): nhãn micro → giá trị lớn (mono) → chú thích.
 * Dùng trong `.grid-kpi`. `accent` tô Volt cho số quan trọng nhất (≤ 1 mỗi hàng).
 */
export function Stat({ label, value, sub, icon, accent, mono = true, size = "l", className }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; accent?: boolean; mono?: boolean; /** "m" cho giá trị dài (vd. hai số) */ size?: "m" | "l"; className?: string }) {
  return (
    <div className={[s.stat, className ?? ""].join(" ")}>
      <div className={s.label}>{icon && <span className={s.icon} aria-hidden>{icon}</span>}{label}</div>
      <div className={[s.value, size === "m" ? s.m : "", mono ? s.mono : "", accent ? s.accent : ""].join(" ")}>{value}</div>
      {sub && <div className={s.sub}>{sub}</div>}
    </div>
  );
}
