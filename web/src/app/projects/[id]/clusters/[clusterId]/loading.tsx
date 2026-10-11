import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingPage, PanelSkeleton, ProjectHeaderSkeleton } from "@/components/shell/Skeletons";

/** Editor cluster: thanh công cụ → khung bản đồ → bảng node. */
export default function Loading() {
  return (
    <LoadingPage label="Đang tải bản đồ cluster…">
      <ProjectHeaderSkeleton />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }} aria-hidden>
        <Skeleton width="min(360px, 70%)" height={26} radius={8} />
        <span style={{ flex: "1 1 auto" }} />
        <Skeleton width={96} height={40} radius={10} />
        <Skeleton width={96} height={40} radius={10} />
      </div>
      <PanelSkeleton title={false} height="clamp(360px, 60vh, 620px)" />
      <PanelSkeleton rows={4} />
    </LoadingPage>
  );
}
