import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingPage, PanelSkeleton, ProjectHeaderSkeleton } from "@/components/shell/Skeletons";

/** Trình soạn thảo bài: thanh công cụ → vùng soạn (trái) + điểm SEO/GEO (phải từ 900px). */
export default function Loading() {
  return (
    <LoadingPage label="Đang mở trình soạn thảo…">
      <ProjectHeaderSkeleton />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }} aria-hidden>
        <Skeleton width={90} height={20} radius={5} />
        <Skeleton width={140} height={12} />
        <span style={{ flex: "1 1 auto" }} />
        <Skeleton width={88} height={40} radius={10} />
        <Skeleton width={104} height={40} radius={10} />
      </div>
      <div className="two-col">
        <div className="stack">
          <PanelSkeleton fields={2} />
          <PanelSkeleton title={false} height="clamp(320px, 55vh, 640px)" />
        </div>
        <aside><PanelSkeleton lines={8} /></aside>
      </div>
    </LoadingPage>
  );
}
