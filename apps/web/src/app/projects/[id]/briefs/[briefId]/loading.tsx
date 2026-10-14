import { Skeleton } from "@/components/ui/Skeleton";
import { KpiSkeleton, LoadingPage, PanelSkeleton, ProjectHeaderSkeleton, SplitSkeleton } from "@/components/shell/Skeletons";

/** Chi tiết brief: tiêu đề + badge + hành động → 4 ô → góc viết → outline dài → các panel đôi. */
export default function Loading() {
  return (
    <LoadingPage label="Đang tải brief…">
      <ProjectHeaderSkeleton />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px 12px", alignItems: "flex-end", justifyContent: "space-between" }} aria-hidden>
        <div style={{ display: "grid", gap: 10, flex: "1 1 320px", minWidth: 0 }}>
          <Skeleton width={220} height={11} />
          <Skeleton width="min(560px, 92%)" height={30} radius={8} />
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Skeleton width={90} height={18} radius={5} /><Skeleton width={80} height={18} radius={5} /><Skeleton width={100} height={18} radius={5} /></span>
        </div>
        <span style={{ display: "flex", gap: 8 }}><Skeleton width={110} height={40} radius={10} /><Skeleton width={130} height={40} radius={10} /></span>
      </div>
      <KpiSkeleton count={4} panel />
      <PanelSkeleton lines={3} />
      <PanelSkeleton lines={10} />
      <SplitSkeleton min={420}>
        <PanelSkeleton lines={5} />
        <PanelSkeleton lines={5} />
      </SplitSkeleton>
    </LoadingPage>
  );
}
