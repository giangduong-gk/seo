import type { ReactNode } from "react";
import s from "./EmptyState.module.css";

/** Trạng thái trống: icon + tiêu đề + mô tả + hành động; hiện nhẹ nhàng (fade + rise). `compact` giảm padding cho panel hẹp. */
export function EmptyState({ icon, title, text, action, compact, className }: { icon?: ReactNode; title: string; text?: ReactNode; action?: ReactNode; compact?: boolean; className?: string }) {
  return (
    <div className={[s.empty, compact ? s.compact : "", className ?? ""].join(" ")}>
      {icon && <div className={s.tile}>{icon}</div>}
      <div className={s.title}>{title}</div>
      {text && <p className={s.text}>{text}</p>}
      {action && <div className={s.action}>{action}</div>}
    </div>
  );
}
