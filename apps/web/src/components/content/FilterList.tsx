"use client";

import { ChevronRight, Search, X } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import s from "./FilterList.module.css";

export type FilterItem = { id: string; href?: string; search: string; content: ReactNode; title?: string };

/** Bỏ dấu tiếng Việt để lọc "iphone gia" khớp "iphone giá". */
const fold = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

/**
 * Danh sách hàng bấm được (.row-link + .row-arrow) với ô lọc phía client khi có hơn `threshold` hàng.
 * Nội dung mỗi hàng do server render (`content`) → thời gian tương đối không lệch khi hydrate.
 */
export function FilterList({ items, label, placeholder = "Lọc theo từ khoá…", threshold = 5 }: { items: FilterItem[]; label: string; placeholder?: string; threshold?: number }) {
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const index = useMemo(() => items.map((it) => fold(it.search)), [items]);
  const needle = fold(dq.trim());
  const visible = needle ? items.filter((_, i) => index[i].includes(needle)) : items;

  return (
    <div className={s.wrap}>
      {items.length > threshold && (
        <div className={s.filter}>
          <label className={s.field}>
            <Search size={14} className={s.icon} aria-hidden />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={label} className={s.input} autoComplete="off" />
            {q && <button type="button" className={s.clear} onClick={() => setQ("")} aria-label="Xoá bộ lọc"><X size={14} aria-hidden /></button>}
          </label>
          <span className={s.count} aria-live="polite">{visible.length}/{items.length}</span>
        </div>
      )}
      <ul className={s.list}>
        {visible.map((it) => (
          <li key={it.id}>
            {it.href ? (
              <Link href={it.href} className={`row-link ${s.row}`} title={it.title}>
                {it.content}
                <ChevronRight size={16} className="row-arrow" aria-hidden />
              </Link>
            ) : (
              <div className={`${s.row} ${s.static}`} title={it.title}>{it.content}</div>
            )}
          </li>
        ))}
      </ul>
      {visible.length === 0 && (
        <p className={s.none}>Không có mục nào khớp “{dq}”. <button type="button" onClick={() => setQ("")}>Xoá bộ lọc</button></p>
      )}
    </div>
  );
}
