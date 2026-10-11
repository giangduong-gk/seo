"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import s from "./content.module.css";

/**
 * Đoạn dài → cắt còn `lines` dòng + nút "Xem thêm"/"Thu gọn" (aria-expanded).
 * Văn bản có thể bị cắt (theo độ dài) luôn giữ chỗ cho nút → không nhảy layout; sau khi đo, nút chỉ còn hiện khi thật sự bị cắt.
 */
export function ClampText({ text, children, lines = 4, threshold = 180, className }: { text: string; children?: ReactNode; lines?: number; threshold?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const mayClip = text.length > threshold;
  // SSR: giả định bị cắt (nút hiện sẵn) → sau khi đo, nếu vừa đủ chỗ thì chỉ ẩn nút (visibility), không đổi layout
  const [clipped, setClipped] = useState(mayClip);

  useEffect(() => {
    const el = ref.current;
    if (!el || !mayClip) return;
    const measure = () => { if (!el.classList.contains(s.clamp)) return; setClipped(el.scrollHeight > el.clientHeight + 2); };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mayClip, open]);

  const body = children ?? <p>{text}</p>;
  if (!mayClip) return <div className={className}>{body}</div>;
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column" }}>
      <div ref={ref} className={open ? undefined : s.clamp} data-clipped={!open && clipped ? "" : undefined} style={{ ["--lines" as string]: lines }}>{body}</div>
      <button type="button" className={s.more} aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ visibility: clipped || open ? "visible" : "hidden" }}>
        {open ? "Thu gọn" : "Xem thêm"}
      </button>
    </div>
  );
}
