"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useWide } from "./hooks";
import s from "./ArticleEditor.module.css";

/**
 * Khối thu gọn được ở cột phụ (cùng khung với Panel). Trên điện thoại cột phụ nằm dưới trình soạn thảo →
 * `defaultOpen="wide"` nghĩa là mở sẵn trên desktop, thu gọn trên điện thoại.
 */
export function Section({ title, sub, defaultOpen = false, flush, children, id }: { title: ReactNode; sub?: ReactNode; defaultOpen?: boolean | "wide"; flush?: boolean; children: ReactNode; id?: string }) {
  const wide = useWide();
  const [open, setOpen] = useState(defaultOpen !== false);
  useEffect(() => { if (defaultOpen === "wide" && !wide) setOpen(false); }, [defaultOpen, wide]);
  return (
    <details className={s.details} open={open} onToggle={(e) => setOpen(e.currentTarget.open)} id={id}>
      <summary><span className={s.sumTitle}>{title}</span>{sub != null && <span className={s.sum}>{sub}</span>}</summary>
      <div className={flush ? s.detailsFlush : s.detailsBody}>{children}</div>
    </details>
  );
}
