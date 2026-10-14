"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Thanh tiến trình mảnh màu Volt ở đỉnh trang khi chuyển route (App Router không có sự kiện "start").
 * Bắt đầu khi bấm link nội bộ; kết thúc khi pathname/search thay đổi; tự tắt sau 12s để không treo.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // cùng trang / chỉ đổi hash
      setState("loading");
      if (safety.current) clearTimeout(safety.current);
      safety.current = setTimeout(() => setState("idle"), 12000);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
    const t = setTimeout(() => setState((s) => (s === "done" ? "idle" : s)), 320);
    return () => clearTimeout(t);
  }, [pathname, search]);

  if (state === "idle") return null;
  return (
    <div aria-hidden style={{ position: "fixed", top: 0, left: 0, right: 0, height: 2, zIndex: "calc(var(--z-sticky) + 1)" as unknown as number, pointerEvents: "none" }}>
      <div style={{
        height: "100%", background: "var(--volt-gradient)", boxShadow: "0 0 8px rgba(255,234,0,0.6)", /* lint-allow-color: glow */
        transformOrigin: "left", transform: state === "done" ? "scaleX(1)" : "scaleX(0.82)", opacity: state === "done" ? 0 : 1,
        transition: state === "done" ? "transform var(--dur-base) var(--ease-out), opacity var(--dur-slow) var(--ease-out) var(--dur-base)" : "transform 8s cubic-bezier(0.1, 0.7, 0.1, 1)",
        animation: state === "loading" ? "navprogress-start var(--dur-slow) var(--ease-out) both" : undefined,
      }} />
      <style>{`@keyframes navprogress-start { from { transform: scaleX(0); } to { transform: scaleX(0.3); } }`}</style>
    </div>
  );
}
