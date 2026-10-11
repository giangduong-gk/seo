"use client";

import { useEffect, useRef, useState } from "react";
import s from "./PageToc.module.css";

export type TocItem = { id: string; label: string };

/**
 * Mục lục + scrollspy cho trang dài (phân tích, brief…). Các section đích cần `id` trùng `items[].id`
 * (Panel nhận prop `id`). Cuộn mượt nhờ `scroll-behavior: smooth` và `scroll-margin-top` trong motion.css.
 * Render 2 biến thể: dải chip ngang dính dưới header (< 1200px) và cột dọc sticky (≥ 1200px) — đặt component
 * ở cột bên của layout 2 cột; trên màn nhỏ nó tự hiển thị dạng chip ở đúng vị trí đặt.
 */
export function PageToc({ items, title = "Trên trang này" }: { items: TocItem[]; title?: string }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const chipRow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((x): x is HTMLElement => !!x);
    if (!els.length) return;
    const visible = new Map<string, number>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
      // mục đầu tiên (theo thứ tự trang) đang hiển thị
      const first = items.find((i) => (visible.get(i.id) ?? 0) > 0);
      if (first) setActive(first.id);
    }, { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.01, 0.5] });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  // giữ chip đang chọn trong tầm nhìn trên mobile
  useEffect(() => {
    const el = chipRow.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(active)}"]`);
    if (el && chipRow.current) chipRow.current.scrollTo({ left: el.offsetLeft - 16, behavior: "smooth" });
  }, [active]);

  if (items.length < 2) return null;
  return (
    <>
      <div ref={chipRow} className={[s.mobile, "scroll-x", "fade-x"].join(" ")} role="navigation" aria-label={title}>
        {items.map((i) => <a key={i.id} data-id={i.id} href={`#${i.id}`} className={[s.chip, active === i.id ? s.chipActive : ""].join(" ")} aria-current={active === i.id ? "location" : undefined}>{i.label}</a>)}
      </div>
      <nav className={s.desktop} aria-label={title}>
        <div className={s.title}>{title}</div>
        <div className={s.list}>
          {items.map((i) => <a key={i.id} href={`#${i.id}`} className={[s.link, active === i.id ? s.active : ""].join(" ")} aria-current={active === i.id ? "location" : undefined}>{i.label}</a>)}
        </div>
      </nav>
    </>
  );
}
