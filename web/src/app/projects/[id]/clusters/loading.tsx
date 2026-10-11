import { LoadingPage, PanelSkeleton, ProjectHeaderSkeleton, SplitSkeleton } from "@/components/shell/Skeletons";

/** Topic Cluster: form xây cluster | danh sách cluster + cảnh báo cannibalization. */
export default function Loading() {
  return (
    <LoadingPage label="Đang tải Topic Cluster…">
      <ProjectHeaderSkeleton />
      <SplitSkeleton>
        <PanelSkeleton fields={2} lines={3} />
        <div className="stack">
          <PanelSkeleton rows={3} />
          <PanelSkeleton lines={2} />
        </div>
      </SplitSkeleton>
    </LoadingPage>
  );
}
