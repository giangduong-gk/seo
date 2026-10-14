import { Skeleton } from "@/components/ui/Skeleton";
import { ProjectTabsSkeleton } from "./ProjectTabsSkeleton";
import s from "./Skeletons.module.css";

/**
 * Khối skeleton cho loading.tsx — cùng kích thước/khoảng cách với trang thật (container, panel 52px, row 52px…)
 * để khi dữ liệu tới không nhảy layout. Tất cả aria-hidden; vùng ngoài có role="status" + nhãn ẩn.
 */

export function LoadingPage({ children, label = "Đang tải…" }: { children: React.ReactNode; label?: string }) {
  return (
    <div className={["container stack", s.page].join(" ")} role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Thanh skeleton nằm trong phần tử chữ thật → cao đúng line-height của kiểu chữ đó (không lệch khi trang tới). */
export function TextBar({ width }: { width: number | string }) {
  return <span className="skeleton" style={{ display: "inline-block", width, maxWidth: "100%", height: "0.9em", verticalAlign: "middle", borderRadius: 6 }} />;
}

/** Đầu trang kiểu .page-head: eyebrow + tiêu đề display + một dòng mô tả. */
export function PageHeadSkeleton({ display = true, sub = true }: { display?: boolean; sub?: boolean }) {
  return (
    <div className="page-head" aria-hidden>
      <div className="micro"><TextBar width={84} /></div>
      <div className={display ? "display" : "h1"}><TextBar width={display ? "min(240px, 60%)" : "min(420px, 80%)"} /></div>
      {sub && <p className="sub"><TextBar width="min(560px, 100%)" /><span className={s.narrowOnly}><br /><TextBar width="55%" /></span></p>}
    </div>
  );
}

/** Đầu trang dự án (breadcrumb → tên → meta + badge) + dải tab thật (tab đang mở suy ra từ URL). */
export function ProjectHeaderSkeleton() {
  return (
    <>
      <div className={s.projectHead} aria-hidden>
        <div className="crumbs"><span><TextBar width="min(260px, 70%)" /></span></div>
        <div className={s.title}><TextBar width="min(320px, 75%)" /></div>
        <span className={s.metaRow}><span className={s.metaText}><TextBar width={180} /></span><Skeleton width={110} height={18} radius={5} /><Skeleton width={52} height={18} radius={5} /></span>
      </div>
      <ProjectTabsSkeleton />
    </>
  );
}

/** Panel có header 52px; `rows` → danh sách hàng (flush) · `lines` → đoạn văn · `fields` → form. */
export function PanelSkeleton({ title = true, rows, lines, fields, height, action }: { title?: boolean; rows?: number; lines?: number; fields?: number; height?: number | string; action?: boolean }) {
  return (
    <div className={s.panel} aria-hidden>
      {title && (
        <div className={s.panelHead}>
          <Skeleton width={140} height={14} />
          {action && <Skeleton width={72} height={28} radius={8} />}
        </div>
      )}
      {rows ? (
        <div className={s.rows}>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className={s.row}>
              <span className={s.rowText}>
                <Skeleton width={`${[62, 48, 70, 55, 66, 44][i % 6]}%`} height={14} />
                <Skeleton width={`${[38, 30, 42, 34, 40, 28][i % 6]}%`} height={11} />
              </span>
              <Skeleton width={64} height={18} radius={5} />
            </div>
          ))}
        </div>
      ) : (
        <div className={s.body}>
          {fields ? Array.from({ length: fields }, (_, i) => (
            <span key={i} className={s.field}><Skeleton width={i % 2 ? 120 : 90} height={11} /><Skeleton height={40} radius={10} /></span>
          )) : null}
          {fields ? <Skeleton width={120} height={40} radius={10} /> : null}
          {lines ? <Skeleton lines={lines} height={13} gap={10} /> : null}
          {height ? <Skeleton height={typeof height === "number" ? height : undefined} style={typeof height === "string" ? { height } : undefined} radius={10} /> : null}
        </div>
      )}
    </div>
  );
}

/** Hàng ô KPI (dùng .grid-kpi như trang thật). `panel` → ô có header (Panel) thay vì Stat gọn. */
export function KpiSkeleton({ count = 4, panel, min }: { count?: number; panel?: boolean; /** bề rộng tối thiểu mỗi ô (px) nếu trang thật đổi cột */ min?: number }) {
  return (
    <div className="grid-kpi" aria-hidden style={min ? { gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))` } : undefined}>
      {Array.from({ length: count }, (_, i) =>
        panel ? <PanelSkeleton key={i} lines={2} /> : (
          <div key={i} className={s.stat}>
            <div className={s.statLabel}><TextBar width={90} /></div>
            <div className={s.statValue}><TextBar width={i % 2 ? 96 : 120} /></div>
            <div className={s.statSub}><TextBar width={110} /></div>
          </div>
        ))}
    </div>
  );
}

/** Lưới 2 cột tự xuống hàng như các trang danh sách (minmax 380px). */
export function SplitSkeleton({ children, min = 380 }: { children: React.ReactNode; min?: number }) {
  return <div className={s.split} style={{ ["--min" as string]: `${min}px` }}>{children}</div>;
}
