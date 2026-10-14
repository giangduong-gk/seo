import type { ReactNode } from "react";
import s from "./Panel.module.css";

/** Panel CMS — header 52px, pad-x 20 dùng chung cho header, body và row. `interactive` → viền/nền sáng dần khi hover (.card-hover). */
export function Panel({ title, sub, action, children, flush, id, className, interactive }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean; id?: string; className?: string; interactive?: boolean }) {
  return (
    <section className={[s.panel, flush ? s.flush : "", interactive ? "card-hover" : "", className ?? ""].join(" ")} id={id} aria-label={typeof title === "string" ? title : undefined}>
      {(title || action) && (
        <header className={s.head}>
          <div className={s.headText}><span className={s.title}>{title}</span>{sub && <span className={s.sub}>{sub}</span>}</div>
          {action}
        </header>
      )}
      <div className={s.body}>{children}</div>
    </section>
  );
}
