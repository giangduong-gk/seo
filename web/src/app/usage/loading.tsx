import { KpiSkeleton, LoadingPage, PageHeadSkeleton, PanelSkeleton, SplitSkeleton } from "@/components/shell/Skeletons";

/** Chi phí AI: đầu trang → 4 ô KPI → biểu đồ + bảng theo dự án → bảng theo tính năng. */
export default function Loading() {
  return (
    <LoadingPage label="Đang tải chi phí AI…">
      <PageHeadSkeleton />
      <KpiSkeleton count={4} min={150} />
      <SplitSkeleton min={420}>
        <PanelSkeleton lines={6} />
        <PanelSkeleton rows={3} />
      </SplitSkeleton>
      <PanelSkeleton rows={5} />
    </LoadingPage>
  );
}
