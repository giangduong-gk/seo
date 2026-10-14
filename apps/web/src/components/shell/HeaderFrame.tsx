"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Khung header dính: thêm `data-scrolled` khi trang đã cuộn (> 4px) để hiện viền/bóng.
 * Ghi thẳng attribute lên DOM (rAF-throttle) → không re-render khi cuộn.
 */
export function HeaderFrame({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let last: boolean | null = null;
    const update = () => {
      raf = 0;
      const on = window.scrollY > 4;
      if (on !== last) { last = on; el.toggleAttribute("data-scrolled", on); }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return <header ref={ref} className={className}>{children}</header>;
}
