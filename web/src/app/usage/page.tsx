import { Panel, Table } from "@/components/ui";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chi phí AI" };

export default async function UsagePage() {
  const [byProject, byFeature, total] = await Promise.all([
    prisma.aiUsage.groupBy({ by: ["projectId"], _sum: { costUsd: true, inputTokens: true, outputTokens: true, cacheReadTokens: true }, _count: true }),
    prisma.aiUsage.groupBy({ by: ["feature", "model"], _sum: { costUsd: true, inputTokens: true, outputTokens: true, cacheReadTokens: true }, _count: true }),
    prisma.aiUsage.aggregate({ _sum: { costUsd: true, inputTokens: true, outputTokens: true, cacheReadTokens: true }, _count: true }),
  ]);
  const projects = await prisma.project.findMany({ where: { id: { in: byProject.map((p) => p.projectId).filter((x): x is string => Boolean(x)) } }, select: { id: true, name: true } });
  const nameOf = (id: string | null) => projects.find((p) => p.id === id)?.name ?? "—";
  const usd = (n?: number | null) => `$${(n ?? 0).toFixed(4)}`;
  const num = (n?: number | null) => (n ?? 0).toLocaleString("vi-VN");
  const cacheRate = total._sum.inputTokens ? (total._sum.cacheReadTokens ?? 0) / ((total._sum.inputTokens ?? 0) + (total._sum.cacheReadTokens ?? 0)) : 0;

  return (
    <div className="container stack page-in">
      <div>
        <div className="micro">Vận hành</div>
        <h1 className="display">Chi phí AI</h1>
        <p className="secondary" style={{ marginTop: 8 }}>Ước tính theo bảng giá Claude API; dùng để đặt hạn mức và kiểm tra cache.</p>
      </div>
      <div className="grid-kpi">
        <Panel title="Tổng chi phí"><div className="h2 mono">{usd(total._sum.costUsd)}</div><p className="caption">{total._count} lần gọi</p></Panel>
        <Panel title="Token vào / ra"><div className="h3 mono">{num(total._sum.inputTokens)} / {num(total._sum.outputTokens)}</div></Panel>
        <Panel title="Tỷ lệ cache hit"><div className="h2 mono">{Math.round(cacheRate * 100)}%</div><p className="caption">cache_read_input_tokens trên tổng input</p></Panel>
      </div>
      <Panel title="Theo dự án" flush>
        <Table columns={["Dự án", "Lần gọi", "Input", "Output", "Cache read", "Chi phí"]} rows={byProject.map((p) => [nameOf(p.projectId), p._count, num(p._sum.inputTokens), num(p._sum.outputTokens), num(p._sum.cacheReadTokens), <span key="c" className="mono">{usd(p._sum.costUsd)}</span>])} minWidth={640} />
      </Panel>
      <Panel title="Theo tính năng & model" flush>
        <Table columns={["Tính năng", "Model", "Lần gọi", "Input", "Output", "Chi phí"]} rows={byFeature.map((f) => [f.feature, <span key="m" className="mono">{f.model}</span>, f._count, num(f._sum.inputTokens), num(f._sum.outputTokens), <span key="c" className="mono">{usd(f._sum.costUsd)}</span>])} minWidth={640} />
      </Panel>
    </div>
  );
}
