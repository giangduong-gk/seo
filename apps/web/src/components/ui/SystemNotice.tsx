import { CircleAlert, Info, OctagonAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import s from "./SystemNotice.module.css";

/** Thông báo hệ thống trong trang. `onClose` (từ client component) → hiện nút đóng. */
export function SystemNotice({ tone = "neutral", title, children, action, onClose, closeLabel = "Đóng thông báo" }: { tone?: "amber" | "red" | "blue" | "neutral"; title?: string; children?: ReactNode; action?: ReactNode; onClose?: () => void; closeLabel?: string }) {
  const Icon = tone === "red" ? OctagonAlert : tone === "amber" ? CircleAlert : Info;
  return (
    <div className={[s.notice, s[tone]].join(" ")} role={tone === "red" ? "alert" : "status"}>
      <Icon size={16} className={s.icon} aria-hidden />
      <div className={s.content}>{title && <strong>{title}</strong>}{children}</div>
      {action}
      {onClose && <button type="button" className={s.close} onClick={onClose} aria-label={closeLabel}><X size={14} aria-hidden /></button>}
    </div>
  );
}
