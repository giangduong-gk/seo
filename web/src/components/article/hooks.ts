"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** matchMedia dạng hook (SSR trả `fallback`). */
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback((cb: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => fallback);
}

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");
export const useWide = () => useMediaQuery("(min-width: 900px)", true);

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Số chạy từ giá trị trước tới `target` trong `duration` ms (ease-out). Tắt khi reduced motion. */
export function useCountUp(target: number, duration = 600): number {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) { from.current = target; setV(target); return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      const cur = a + (target - a) * e;
      setV(cur);
      from.current = cur;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

/** Textarea tự cao theo nội dung (không bao giờ bị cắt). Đo lại khi giá trị hoặc bề rộng đổi. */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string, enabled = true) {
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (!enabled) { el.style.height = ""; return; }
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, enabled]);
  useIsoLayoutEffect(() => { fit(); }, [fit, value]);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof ResizeObserver === "undefined") return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => { if (el.clientWidth !== w) { w = el.clientWidth; fit(); } });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, fit, enabled]);
}

/** Số giây đã trôi qua khi `running` (reset mỗi lần bắt đầu). */
export function useElapsed(running: boolean): number {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    setSec(0);
    const id = setInterval(() => setSec(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running]);
  return sec;
}

export function fmtElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, "0")}`;
}

/** Đóng khi bấm ra ngoài hoặc Esc. */
export function useDismiss(open: boolean, refs: RefObject<HTMLElement | null>[], onClose: (via: "esc" | "outside") => void) {
  const cb = useRef(onClose);
  useEffect(() => { cb.current = onClose; });
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!refs.some((r) => r.current?.contains(e.target as Node))) cb.current("outside"); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); cb.current("esc"); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/** Đích nhập liệu (đang gõ) → bỏ qua phím tắt một ký tự. */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}
