import { Clock3, FileSearch, Globe, Network, Search, Tags } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge, EmptyState, Panel, SystemNotice } from "@/components/ui";
import { FilterList } from "@/components/content/FilterList";
import { TimeAgo } from "@/components/content/time";
import c from "@/components/content/content.module.css";
import { hasApiKey } from "@/lib/claude";
import { ProjectHeader } from "../ProjectHeader";
import { prisma } from "@/lib/db";
import { KeywordForm } from "../KeywordForm";
import { IntentBadge } from "../IntentBadge";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { analyses: { orderBy: { createdAt: "desc" }, include: { keyword: true } } },
  });
  if (!project) notFound();
  const canRun = hasApiKey();

  return (
    <div className="container stack page-in">
      <ProjectHeader projectId={project.id} active="analyses" />

      {!canRun && <SystemNotice tone="amber" title="Chưa cấu hình ANTHROPIC_API_KEY">Thêm khoá vào <code className="mono">web/.env</code> để chạy phân tích.</SystemNotice>}

      <div className={c.workspace}>
        <div className={`${c.workspaceForm} ${c.sticky}`}>
          <Panel title="Phân tích từ khoá / chủ đề">
            <KeywordForm projectId={project.id} disabled={!canRun} />
            <ul className={c.tips} aria-label="Kết quả gồm">
              <li><Globe size={14} aria-hidden />Đọc SERP thật (web research) và đối thủ nổi bật</li>
              <li><FileSearch size={14} aria-hidden />Ý định, độ khó, góc viết, title & meta đề xuất</li>
              <li><Tags size={14} aria-hidden />Từ khoá ngữ nghĩa, thực thể & schema</li>
              <li><Network size={14} aria-hidden />Gợi ý topic cluster, checklist GEO, FAQ</li>
              <li><Clock3 size={14} aria-hidden />Thường mất 1–3 phút mỗi từ khoá</li>
            </ul>
          </Panel>
        </div>

        <div className={c.workspaceList}>
          <Panel title="Lịch sử phân tích" sub={`${project.analyses.length}`} flush>
            {project.analyses.length === 0 ? (
              <EmptyState icon={<Search size={22} />} title="Chưa có phân tích" text="Nhập một từ khoá ở khung bên cạnh — phân tích đầu tiên mất khoảng 1–3 phút." />
            ) : (
              <FilterList
                label="Lọc lịch sử phân tích"
                items={project.analyses.map((a) => {
                  const done = a.status === "done";
                  return {
                    id: a.id,
                    href: done ? `/projects/${project.id}/analyses/${a.id}` : undefined,
                    search: `${a.keyword.term} ${a.keyword.intent ?? ""}`,
                    title: done ? undefined : a.error ?? undefined,
                    content: (
                      <>
                        <span className={c.rowMain}>
                          <span className={c.rowTitle}>{a.keyword.term}</span>
                          <span className={c.rowMeta}>
                            <TimeAgo date={a.createdAt} />
                            <span className={c.dot} aria-hidden>·</span>
                            <span className="mono">{a.model}</span>
                          </span>
                        </span>
                        <span className={c.rowSide}>
                          {done ? <IntentBadge intent={a.keyword.intent} /> : <Badge tone="danger" title={a.error ?? undefined}>{a.status === "refused" ? "Từ chối" : "Lỗi"}</Badge>}
                        </span>
                      </>
                    ),
                  };
                })}
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
