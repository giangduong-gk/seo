import { LoadingPage, PanelSkeleton, ProjectHeaderSkeleton, SplitSkeleton } from "@/components/shell/Skeletons";

/** Bài viết: form viết bài | danh sách bài. */
export default function Loading() {
  return (
    <LoadingPage label="Đang tải bài viết…">
      <ProjectHeaderSkeleton />
      <SplitSkeleton>
        <PanelSkeleton fields={2} />
        <PanelSkeleton rows={4} />
      </SplitSkeleton>
    </LoadingPage>
  );
}
