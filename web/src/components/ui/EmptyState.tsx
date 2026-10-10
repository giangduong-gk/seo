import type { ReactNode } from "react";
import s from "./EmptyState.module.css";

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className={s.empty}>
      {icon && <div className={s.tile}>{icon}</div>}
      <div className={s.title}>{title}</div>
      {text && <p className={s.text}>{text}</p>}
      {action}
    </div>
  );
}
