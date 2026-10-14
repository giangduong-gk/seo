import { LoadingPage, PanelSkeleton, ProjectHeaderSkeleton, SplitSkeleton } from "@/components/shell/Skeletons";

/** Content Brief: form tạo brief | danh sách brief. */
export default function Loading() {
  return (
    <LoadingPage label="Đang tải Content Brief…">
      <ProjectHeaderSkeleton />
      <SplitSkeleton>
        <PanelSkeleton fields={2} />
        <PanelSkeleton rows={4} />
      </SplitSkeleton>
    </LoadingPage>
  );
}
