import { LoadingPage, PanelSkeleton, ProjectHeaderSkeleton } from "@/components/shell/Skeletons";

/** Dự án · Phân tích từ khoá: đầu trang + tab → form phân tích → lịch sử. */
export default function Loading() {
  return (
    <LoadingPage label="Đang tải dự án…">
      <ProjectHeaderSkeleton />
      <PanelSkeleton fields={1} />
      <PanelSkeleton rows={5} />
    </LoadingPage>
  );
}
