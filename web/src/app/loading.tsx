import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingPage, PageHeadSkeleton, PanelSkeleton } from "@/components/shell/Skeletons";

/** Trang chủ: đầu trang → lưới thẻ dự án + cột tạo dự án. */
export default function Loading() {
  return (
    <LoadingPage>
      <PageHeadSkeleton />
      <div className="two-col wide-aside">
        <div className="stack" style={{ gap: "var(--space-3)" }}>
          <Skeleton width={130} height={18} />
          <div className="card-grid" style={{ ["--grid-card-min" as string]: "300px" }}>
            {[0, 1].map((i) => (
              <div key={i} style={{ display: "grid", gap: 12, padding: "16px var(--cms-panel-pad-x)", background: "var(--surface-card)", border: "1px solid var(--line-1)", borderRadius: "var(--cms-panel-radius)" }} aria-hidden>
                <Skeleton width="70%" height={20} />
                <Skeleton width="55%" height={13} />
                <Skeleton height={56} radius={8} />
                <Skeleton width="40%" height={12} />
              </div>
            ))}
          </div>
        </div>
        <aside><PanelSkeleton fields={4} /></aside>
      </div>
    </LoadingPage>
  );
}
