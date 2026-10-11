"use client";

import { Copy } from "lucide-react";
import { useCopy } from "./copy";
import s from "./CopyChips.module.css";

type Item = { term: string; note?: string | null };

/** Nhóm chip từ khoá: bấm chip → copy từ khoá; "Copy tất cả" → mỗi dòng một từ khoá. */
export function CopyChips({ label, items, tone = "default" }: { label: string; items: Item[]; tone?: "default" | "primary" | "muted" }) {
  const copy = useCopy();
  return (
    <div className={s.group}>
      <div className={s.head}>
        <span className="micro">{label} · {items.length}</span>
        <button type="button" className={s.copyAll} onClick={() => copy(items.map((i) => i.term).join("\n"), `Đã copy ${items.length} từ khoá`, label)} aria-label={`Copy tất cả từ khoá nhóm ${label}`}>
          <Copy size={12} aria-hidden /> Copy tất cả
        </button>
      </div>
      <div className={s.chips}>
        {items.map((k) => (
          <button key={k.term} type="button" className={[s.chip, tone === "primary" ? s.primary : tone === "muted" ? s.muted : ""].join(" ")}
            title={k.note ? `${k.note} — bấm để copy` : "Bấm để copy"} onClick={() => copy(k.term, `Đã copy: ${k.term}`)}>
            <span className={s.chipLabel}>{k.term}</span>
            <Copy size={12} className={s.chipIcon} aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
