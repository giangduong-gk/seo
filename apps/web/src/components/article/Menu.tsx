"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useDismiss } from "./hooks";
import s from "./ArticleEditor.module.css";

/**
 * Menu nhỏ (popover) — nút bấm mở danh sách; đóng bằng Esc, bấm ra ngoài hoặc chọn mục.
 * `children` nhận hàm `close` để mục tự đóng menu.
 */
export function Menu({ label, icon, children, align = "end", className, title, open: openProp, onOpenChange, placement = "bottom", role = "menu", popLabel }: {
  label: ReactNode; icon?: ReactNode; children: (close: () => void) => ReactNode; align?: "start" | "end"; className?: string; title?: string;
  open?: boolean; onOpenChange?: (o: boolean) => void; placement?: "bottom" | "top"; role?: "menu" | "dialog"; popLabel?: string;
}) {
  const [inner, setInner] = useState(false);
  const open = openProp ?? inner;
  const setOpen = (o: boolean) => { if (openProp === undefined) setInner(o); onOpenChange?.(o); };
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const id = useId();
  useDismiss(open, [btn, pop], (via) => { setOpen(false); if (via === "esc") btn.current?.focus(); });

  useEffect(() => {
    if (!open) return;
    const first = pop.current?.querySelector<HTMLElement>("a, button, [tabindex]") ?? pop.current;
    first?.focus({ preventScroll: true });
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(pop.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div className={[s.menuWrap, className ?? ""].join(" ")}>
      <button ref={btn} type="button" className={s.menuBtn} aria-haspopup={role} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)} title={title}>
        {icon}{label}
      </button>
      {open && (
        <div ref={pop} id={id} role={role} aria-label={popLabel} tabIndex={-1} className={[s.menuPop, align === "start" ? s.menuStart : "", placement === "top" ? s.menuTop : ""].join(" ")} onKeyDown={onKeyDown}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
