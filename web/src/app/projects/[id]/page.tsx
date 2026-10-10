import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, EmptyState, Panel, SystemNotice } from "@/components/ui";
import { hasApiKey } from "@/lib/claude";
import { ProjectHeader } from "./ProjectHeader";
import { prisma } from "@/lib/db";
import { KeywordForm } from "./KeywordForm";
import { IntentBadge } from "./IntentBadge";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { analyses: { orderBy: { createdAt: "desc" }, include: { keyword: true } } },
  });
  if (!project) notFound();

  return (
    <div className="container stack page-in">
      <ProjectHeader projectId={project.id} active="analyses" />

      {!hasApiKey() && <SystemNotice tone="amber" title="Chưa cấu hình ANTHROPIC_API_KEY">Thêm khoá vào <code className="mono">web/.env</code> để chạy phân tích.</SystemNotice>}

      <Panel title="Phân tích từ khoá / chủ đề" sub="Claude đọc SERP, phân loại ý định, mở rộng ngữ nghĩa và đề xuất cluster">
        <KeywordForm projectId={project.id} disabled={!hasApiKey()} />
      </Panel>

      <Panel title="Lịch sử phân tích" sub={`${project.analyses.length}`} flush>
        {project.analyses.length === 0 ? (
          <EmptyState icon={<Search size={22} />} title="Chưa có phân tích" text="Nhập một từ khoá ở trên — phân tích đầu tiên mất khoảng 1–3 phút." />
        ) : (
          <ul>
            {project.analyses.map((a) => (
              <li key={a.id} style={{ borderBottom: "1px solid var(--line-1)" }}>
                <Link href={a.status === "done" ? `/projects/${project.id}/analyses/${a.id}` : "#"} aria-disabled={a.status !== "done"} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px var(--cms-panel-pad-x)", minHeight: "var(--cms-row-h)" }}>
                  <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600 }}>{a.keyword.term}</span>
                    <span className="caption mono">{a.createdAt.toLocaleString("vi-VN")} · {a.model}</span>
                  </span>
                  {a.status === "done" ? <IntentBadge intent={a.keyword.intent} /> : <Badge tone="danger" title={a.error ?? undefined}>{a.status === "refused" ? "Từ chối" : "Lỗi"}</Badge>}
                  {a.status === "done" && <ChevronRight size={16} className="muted" aria-hidden />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
