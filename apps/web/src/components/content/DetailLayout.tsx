import type { ReactNode } from "react";
import { PageToc, type TocItem } from "@/components/nav/PageToc";
import s from "./content.module.css";

/**
 * Trang nội dung dài: cột chính + cột phải 220px (≥1200px) gồm mục lục scrollspy và thẻ hành động tuỳ chọn.
 * Dưới 1200px mục lục thành dải chip dính dưới header/SubNav; `aside` ẩn (hành động đã có ở đầu trang).
 */
export function DetailLayout({ toc, aside, children }: { toc: TocItem[]; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className={s.layout}>
      <div className={s.aside}>
        <PageToc items={toc} />
        {aside && <div className={s.asideExtra}>{aside}</div>}
      </div>
      <div className={s.main}>{children}</div>
    </div>
  );
}
