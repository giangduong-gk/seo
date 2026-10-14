"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import s from "./SubNav.module.css";

export type SubNavItem = { href: string; label: string; count?: number; active?: boolean };

// Vị trí gạch chân lần trước — giữ qua các lần chuyển trang (mỗi trang mount lại SubNav) để gạch chân trượt từ tab cũ sang tab mới.
let lastIndicator: { x: number; w: number } | null = null;

const useIsoLayoutEffect = typeof window === "undefined" ? () => {} : useLayoutEffect;

/**
 * Tabs variant="underline" — điều hướng các mục trong một dự án.
 * Dính ngay dưới header (`sticky`, mặc định bật), cuộn ngang có mép mờ trên điện thoại, tab đang chọn tự cuộn vào tầm nhìn,
 * một gạch chân duy nhất trượt (transform + width) giữa các tab. Ghi chiều cao vào `--subnav-h` trên :root để neo (#id) không bị che.
 * `renderCount` cho phép skeleton thay số đếm bằng placeholder.
 */
export function SubNav({ items, sticky = true, label = "Mục trong dự án", renderCount }: { items: SubNavItem[]; sticky?: boolean; label?: string; renderCount?: (it: SubNavItem) => ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const activeHref = pending ?? items.find((i) => i.active)?.href ?? null;

  // Đặt gạch chân dưới tab đang chọn; lần đầu: bắt đầu từ vị trí cũ (nếu có) rồi trượt tới.
  useIsoLayoutEffect(() => {
    const ul = list.current, el = bar.current;
    if (!ul || !el) return;
    const a = activeHref ? ul.querySelector<HTMLElement>(`[data-href="${CSS.escape(activeHref)}"]`) : null;
    if (!a) { el.style.opacity = "0"; return; }
    const target = { x: a.offsetLeft, w: a.offsetWidth };
    const apply = (p: { x: number; w: number }) => { el.style.transform = `translateX(${p.x}px)`; el.style.width = `${p.w}px`; el.style.opacity = "1"; };
    if (!ready) {
      el.style.transition = "none";
      apply(lastIndicator ?? target);
      void el.offsetWidth; // chốt vị trí đầu trước khi bật transition
      el.style.transition = "";
      if (lastIndicator && (lastIndicator.x !== target.x || lastIndicator.w !== target.w)) requestAnimationFrame(() => apply(target));
      else apply(target);
      setReady(true);
      // Tab đang chọn vào tầm nhìn (không cuộn mượt lúc mount để khỏi "giật")
      const sc = list.current;
      if (sc && sc.scrollWidth > sc.clientWidth) {
        const left = a.offsetLeft - (sc.clientWidth - a.offsetWidth) / 2;
        sc.scrollLeft = Math.max(0, left);
      }
    } else {
      apply(target);
      // Tab vừa bấm nằm ngoài khung cuộn (điện thoại) → cuộn mượt tới
      const sc = list.current;
      if (sc && (a.offsetLeft < sc.scrollLeft || a.offsetLeft + a.offsetWidth > sc.scrollLeft + sc.clientWidth)) {
        sc.scrollTo({ left: Math.max(0, a.offsetLeft - (sc.clientWidth - a.offsetWidth) / 2), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
    }
    lastIndicator = target;
  }, [activeHref, ready]);

  // Theo dõi đổi kích thước (font tải xong, xoay màn hình) → cập nhật gạch chân và --subnav-h
  useIsoLayoutEffect(() => {
    const root = document.documentElement;
    const ul = list.current, w = wrap.current, el = bar.current;
    if (!w || !ul || !el) return;
    const sync = () => {
      if (sticky) root.style.setProperty("--subnav-h", `${w.offsetHeight}px`);
      const a = ul.querySelector<HTMLElement>("[data-current]");
      if (a) { el.style.transform = `translateX(${a.offsetLeft}px)`; el.style.width = `${a.offsetWidth}px`; lastIndicator = { x: a.offsetLeft, w: a.offsetWidth }; }
    };
    if (sticky) root.style.setProperty("--subnav-h", `${w.offsetHeight}px`);
    const ro = new ResizeObserver(() => { el.style.transition = "none"; sync(); void el.offsetWidth; el.style.transition = ""; });
    ro.observe(w); ro.observe(ul);
    // Đã dính dưới header chưa → data-stuck (nền mờ tràn viền chỉ hiện khi dính). rAF-throttle, ghi thẳng DOM.
    let raf = 0, stuck: boolean | null = null;
    const check = () => {
      raf = 0;
      const on = w.getBoundingClientRect().top <= parseFloat(getComputedStyle(w).top || "0") + 0.5 && window.scrollY > 0;
      if (on !== stuck) { stuck = on; w.toggleAttribute("data-stuck", on); }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    if (sticky) { check(); window.addEventListener("scroll", onScroll, { passive: true }); }
    return () => {
      ro.disconnect();
      if (sticky) { root.style.removeProperty("--subnav-h"); window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); }
    };
  }, [sticky]);

  return (
    <div ref={wrap} className={[s.wrap, sticky ? s.sticky : ""].join(" ")} data-subnav={sticky ? "" : undefined}>
      <nav aria-label={label} className={s.navFrame}>
        <div ref={list} className={[s.nav, "scroll-x", "fade-x", ready ? s.ready : ""].join(" ")}>
          {items.map((it) => {
            const current = it.href === activeHref;
            return (
              <Link
                key={it.href} href={it.href} data-href={it.href} data-current={current ? "" : undefined}
                className={[s.item, it.active ? s.active : "", current ? s.current : ""].join(" ")}
                aria-current={it.active ? "page" : undefined}
                onClick={(e) => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0 && !it.active) setPending(it.href); }}
              >
                {it.label}
                {renderCount ? renderCount(it) : it.count != null && <span className={s.count}>{it.count}</span>}
              </Link>
            );
          })}
          <span ref={bar} className={s.indicator} aria-hidden />
        </div>
      </nav>
    </div>
  );
}
