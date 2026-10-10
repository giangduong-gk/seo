import type { ReactNode } from "react";
import s from "./Panel.module.css";

/** Panel CMS — header 52px, pad-x 20 dùng chung cho header, body và row. */
export function Panel({ title, sub, action, children, flush, id }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean; id?: string }) {
  return (
    <section className={[s.panel, flush ? s.flush : ""].join(" ")} id={id} aria-label={typeof title === "string" ? title : undefined}>
      {(title || action) && (
        <header className={s.head}>
          <div><span className={s.title}>{title}</span>{sub && <span className={s.sub}>{sub}</span>}</div>
          {action}
        </header>
      )}
      <div className={s.body}>{children}</div>
    </section>
  );
}
