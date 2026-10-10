import { FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, EmptyState, Panel, SystemNotice } from "@/components/ui";
import { hasApiKey } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { IntentBadge } from "../IntentBadge";
import { ProjectHeader } from "../ProjectHeader";
import { BriefForm } from "./BriefForm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function BriefsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id }, include: { briefs: { orderBy: { createdAt: "desc" }, include: { cluster: { select: { title: true } } } }, keywords: { orderBy: { createdAt: "desc" }, select: { term: true, intent: true } } } });
  if (!project) notFound();

  return (
    <div className="container stack page-in">
      <ProjectHeader projectId={id} active="briefs" trail="Content Brief" />
      {!hasApiKey() && <SystemNotice tone="amber" title="Chưa cấu hình ANTHROPIC_API_KEY">Thêm khoá vào <code className="mono">web/.env</code> để tạo brief.</SystemNotice>}
      <div style={{ display: "grid", gap: "var(--cms-grid-gap)", gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))", alignItems: "start" }}>
        <Panel title="Tạo Content Brief" sub="outline answer-first · E-E-A-T · schema · multi-format">
          <BriefForm projectId={id} keywords={project.keywords.map((k) => k.term)} disabled={!hasApiKey()} />
        </Panel>
        <Panel title="Brief đã tạo" sub={`${project.briefs.length}`} flush>
          {project.briefs.length === 0 ? (
            <EmptyState icon={<FileText size={22} />} title="Chưa có brief" text="Nhập từ khoá mục tiêu, hoặc bấm 'Tạo brief' trên một node trong Topic Cluster." />
          ) : (
            <ul>
              {project.briefs.map((b) => {
                const d = JSON.parse(b.data) as { intent?: string; wordCountMin?: number; wordCountMax?: number };
                return (
                  <li key={b.id} style={{ borderBottom: "1px solid var(--line-1)" }}>
                    <Link href={`/projects/${id}/briefs/${b.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px var(--cms-panel-pad-x)", minHeight: "var(--cms-row-h)" }}>
                      <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 600 }}>{b.title}</span>
                        <span className="caption mono">{b.targetKeyword}{b.cluster ? ` · ${b.cluster.title}` : ""} · {b.createdAt.toLocaleDateString("vi-VN")}</span>
                      </span>
                      {d.wordCountMin != null && <Badge tone="outline">{d.wordCountMin}–{d.wordCountMax} từ</Badge>}
                      <IntentBadge intent={d.intent} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
