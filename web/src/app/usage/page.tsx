import { BarChart3 } from "lucide-react";
import { BarList, EmptyState, Panel, Stat, Table } from "@/components/ui";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chi phí AI" };

const FEATURE_LABEL: Record<string, string> = {
  keyword_analysis: "Phân tích từ khoá",
  serp_research: "Nghiên cứu SERP",
  cluster_map: "Topic Cluster",
  content_brief: "Content Brief",
  article_write: "Viết bài",
  article_fix: "Sửa bài",
  article_score: "Chấm điểm (AI)",
};
const featureName = (f: string) => FEATURE_LABEL[f] ?? f;

export default async function UsagePage() {
  const [byProject, byFeature, total] = await Promise.all([
    prisma.aiUsage.groupBy({ by: ["projectId"], _sum: { costUsd: true, inputTokens: true, outputTokens: true, cacheReadTokens: true }, _count: true }),
    prisma.aiUsage.groupBy({ by: ["feature", "model"], _sum: { costUsd: true, inputTokens: true, outputTokens: true, cacheReadTokens: true }, _count: true }),
    prisma.aiUsage.aggregate({ _sum: { costUsd: true, inputTokens: true, outputTokens: true, cacheReadTokens: true }, _count: true }),
  ]);
  const projects = await prisma.project.findMany({ where: { id: { in: byProject.map((p) => p.projectId).filter((x): x is string => Boolean(x)) } }, select: { id: true, name: true } });
  const nameOf = (id: string | null) => projects.find((p) => p.id === id)?.name ?? "—";
  const usd = (n?: number | null) => `$${(n ?? 0).toFixed(4)}`;
  const usd2 = (n?: number | null) => `$${(n ?? 0).toFixed(2)}`;
  const num = (n?: number | null) => (n ?? 0).toLocaleString("vi-VN");
  const compact = (n?: number | null) => new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(n ?? 0);
  const cacheRate = total._sum.inputTokens ? (total._sum.cacheReadTokens ?? 0) / ((total._sum.inputTokens ?? 0) + (total._sum.cacheReadTokens ?? 0)) : 0;
  const totalCost = total._sum.costUsd ?? 0;
  const avg = total._count ? totalCost / total._count : 0;

  // Gộp theo tính năng (bỏ chiều model) cho biểu đồ, sắp giảm dần
  const featureMap = new Map<string, { cost: number; calls: number }>();
  for (const f of byFeature) {
    const k = featureName(f.feature);
    const cur = featureMap.get(k) ?? { cost: 0, calls: 0 };
    featureMap.set(k, { cost: cur.cost + (f._sum.costUsd ?? 0), calls: cur.calls + f._count });
  }
  const bars = [...featureMap.entries()].map(([label, v]) => ({ label, value: v.cost, sub: `${v.calls} lần gọi` })).sort((a, b) => b.value - a.value);
  const projectRows = [...byProject].sort((a, b) => (b._sum.costUsd ?? 0) - (a._sum.costUsd ?? 0));
  const featureRows = [...byFeature].sort((a, b) => (b._sum.costUsd ?? 0) - (a._sum.costUsd ?? 0));

  return (
    <div className="container stack">
      <header className="page-head page-in">
        <div className="micro">Vận hành</div>
        <h1 className="display">Chi phí AI</h1>
        <p className="sub">Ước tính theo bảng giá Claude API — dùng để đặt hạn mức và kiểm tra hiệu quả cache.</p>
      </header>

      {total._count === 0 ? (
        <Panel>
          <EmptyState icon={<BarChart3 size={22} />} title="Chưa có lần gọi AI nào" text="Chạy một phân tích từ khoá trong dự án — chi phí sẽ hiện ở đây." />
        </Panel>
      ) : (
        <>
          <div className="grid-kpi stagger" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))" }}>
            <Stat label="Tổng chi phí" value={usd2(totalCost)} sub={<span className="mono">{usd(totalCost)}</span>} accent />
            <Stat label="Lần gọi" value={num(total._count)} sub={<>TB <span className="mono">{usd(avg)}</span> / lần</>} />
            <Stat label="Token vào / ra" size="m" value={<>{compact(total._sum.inputTokens)}<span className="muted"> / </span>{compact(total._sum.outputTokens)}</>} sub={<span className="mono">{num(total._sum.inputTokens)} / {num(total._sum.outputTokens)}</span>} />
            <Stat label="Tỷ lệ cache hit" value={`${Math.round(cacheRate * 100)}%`} sub="cache_read trên tổng input" />
          </div>

          <div className="stagger" style={{ display: "grid", gap: "var(--cms-grid-gap)", gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))", alignItems: "start" }}>
            <Panel title="Chi phí theo tính năng" sub={`${bars.length} nhóm`}>
              <BarList items={bars} title="Chi phí theo tính năng" formatValue={(n) => usd(n)} />
            </Panel>
            <Panel title="Theo dự án" sub={`${projectRows.length}`} flush>
              <Table
                stickyHeader
                columns={["Dự án", "Lần gọi", "Input", "Output", "Cache read", "Chi phí"]}
                align={{ 1: "right", 2: "right", 3: "right", 4: "right", 5: "right" }}
                rows={projectRows.map((p) => [<span key="p" style={{ whiteSpace: "nowrap" }}>{nameOf(p.projectId)}</span>, <span key="n" className="mono">{p._count}</span>, <span key="i" className="mono">{num(p._sum.inputTokens)}</span>, <span key="o" className="mono">{num(p._sum.outputTokens)}</span>, <span key="r" className="mono">{num(p._sum.cacheReadTokens)}</span>, <span key="c" className="mono" style={{ color: "var(--fg-1)" }}>{usd(p._sum.costUsd)}</span>])}
                minWidth={600}
              />
            </Panel>
          </div>

          <Panel title="Theo tính năng & model" sub={`${featureRows.length}`} flush>
            <Table
              stickyHeader
              columns={["Tính năng", "Model", "Lần gọi", "Input", "Output", "Cache read", "Chi phí"]}
              align={{ 2: "right", 3: "right", 4: "right", 5: "right", 6: "right" }}
              rows={featureRows.map((f) => [<span key="f" style={{ whiteSpace: "nowrap" }}>{featureName(f.feature)}</span>, <span key="m" className="mono" style={{ whiteSpace: "nowrap" }}>{f.model}</span>, <span key="n" className="mono">{f._count}</span>, <span key="i" className="mono">{num(f._sum.inputTokens)}</span>, <span key="o" className="mono">{num(f._sum.outputTokens)}</span>, <span key="r" className="mono">{num(f._sum.cacheReadTokens)}</span>, <span key="c" className="mono" style={{ color: "var(--fg-1)" }}>{usd(f._sum.costUsd)}</span>])}
              minWidth={720}
            />
          </Panel>
        </>
      )}
    </div>
  );
}
