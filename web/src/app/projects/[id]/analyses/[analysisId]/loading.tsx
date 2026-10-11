import { Skeleton } from "@/components/ui/Skeleton";
import { KpiSkeleton, LoadingPage, PanelSkeleton, SplitSkeleton, TextBar } from "@/components/shell/Skeletons";

/** Kết quả phân tích: breadcrumb → từ khoá + badge → 4 ô KPI → các panel nội dung. */
export default function Loading() {
  return (
    <LoadingPage label="Đang tải phân tích…">
      <div className="caption" aria-hidden><TextBar width="min(320px, 80%)" /></div>
      <div aria-hidden>
        <div className="micro"><TextBar width={200} /></div>
        <div className="display" style={{ marginTop: 10 }}><TextBar width="min(520px, 90%)" /></div>
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}><Skeleton width={90} height={18} radius={5} /><Skeleton width={110} height={18} radius={5} /><Skeleton width={120} height={18} radius={5} /></span>
      </div>
      <KpiSkeleton count={4} panel />
      <PanelSkeleton lines={4} />
      <PanelSkeleton lines={3} height={64} />
      <SplitSkeleton min={420}>
        <PanelSkeleton rows={4} />
        <PanelSkeleton lines={6} />
      </SplitSkeleton>
    </LoadingPage>
  );
}
