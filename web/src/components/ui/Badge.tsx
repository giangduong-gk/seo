import type { ReactNode } from "react";
import s from "./Badge.module.css";

export type BadgeTone = "new" | "top" | "neutral" | "outline" | "success" | "warning" | "danger" | "info";

export function Badge({ tone = "neutral", children, title }: { tone?: BadgeTone; children: ReactNode; title?: string }) {
  return <span className={[s.badge, s[tone]].join(" ")} title={title ?? (typeof children === "string" ? children : undefined)}>{children}</span>;
}
