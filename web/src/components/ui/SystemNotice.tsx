import { CircleAlert, Info, OctagonAlert } from "lucide-react";
import type { ReactNode } from "react";
import s from "./SystemNotice.module.css";

export function SystemNotice({ tone = "neutral", title, children, action }: { tone?: "amber" | "red" | "blue" | "neutral"; title?: string; children?: ReactNode; action?: ReactNode }) {
  const Icon = tone === "red" ? OctagonAlert : tone === "amber" ? CircleAlert : Info;
  return (
    <div className={[s.notice, s[tone]].join(" ")} role={tone === "red" ? "alert" : "status"}>
      <Icon size={16} className={s.icon} aria-hidden />
      <div className={s.content}>{title && <strong>{title}</strong>}{children}</div>
      {action}
    </div>
  );
}
