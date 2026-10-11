"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

/** Nút lên đầu trang: hiện sau khi cuộn quá 1,5 màn hình; nằm trên vùng toast, tránh safe-area. */
export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setShow(window.scrollY > window.innerHeight * 1.5)); };
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);
  return (
    <button
      type="button" aria-label="Lên đầu trang" title="Lên đầu trang" tabIndex={show ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
      style={{
        position: "fixed", right: 16, bottom: "calc(16px + var(--fixed-bottom-offset, 0px) + var(--safe-bottom))", zIndex: "var(--z-dropdown)" as unknown as number,
        width: "var(--icon-btn-l)", height: "var(--icon-btn-l)", display: "grid", placeItems: "center", borderRadius: "var(--radius-pill)",
        background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", border: "1px solid var(--line-2)", color: "var(--fg-1)",
        boxShadow: "var(--shadow-raised)", cursor: "pointer",
        opacity: show ? 1 : 0, transform: show ? "none" : "translateY(8px) scale(0.96)", pointerEvents: show ? "auto" : "none",
        transition: "opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)",
      }}
    >
      <ArrowUp size={18} aria-hidden />
    </button>
  );
}
