"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { useCopy } from "./copy";
import s from "./CopyChips.module.css";

/** Nút "Sao chép" nhỏ cho một khối nội dung (đặt ở `action` của Panel). Tên truy cập: `label`. */
export function CopyText({ text, label, toastTitle, children = "Sao chép" }: { text: string; label: string; toastTitle: string; children?: string }) {
  const copy = useCopy();
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(false), 1600); return () => clearTimeout(t); }, [done]);
  return (
    <Button type="button" variant="ghost" size="s" className={s.tap} aria-label={label} title={label}
      iconLeft={done ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      onClick={async () => { if (await copy(text, toastTitle)) setDone(true); }}>
      {done ? "Đã copy" : children}
    </Button>
  );
}
