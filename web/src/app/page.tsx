import { FolderPlus, Search } from "lucide-react";
import Link from "next/link";
import { Badge, EmptyState, Panel, SystemNotice } from "@/components/ui";
import { hasApiKey } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { CreateProjectForm } from "./CreateProjectForm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { keywords: true, analyses: true } } },
  });

  return (
    <div className="container stack page-in">
      <div className="row-head">
        <div className="text">
          <div className="micro">SEO Studio</div>
          <h1 className="display">Dự án</h1>
          <p className="secondary" style={{ marginTop: 8 }}>Mỗi dự án giữ hồ sơ thương hiệu, thực thể và giọng văn — Claude dùng chúng cho mọi phân tích.</p>
        </div>
      </div>

      {!hasApiKey() && (
        <SystemNotice tone="amber" title="Chưa cấu hình ANTHROPIC_API_KEY">
          Thêm khoá vào <code className="mono">web/.env</code> rồi khởi động lại. Bạn vẫn tạo được dự án nhưng chưa chạy phân tích được.
        </SystemNotice>
      )}

      <div style={{ display: "grid", gap: "var(--cms-grid-gap)", gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))", alignItems: "start" }}>
        <Panel title="Dự án hiện có" sub={`${projects.length}`} flush>
          {projects.length === 0 ? (
            <EmptyState icon={<FolderPlus size={22} />} title="Chưa có dự án" text="Tạo dự án đầu tiên ở bên cạnh để bắt đầu phân tích từ khoá." />
          ) : (
            <ul>
              {projects.map((p) => (
                <li key={p.id} style={{ borderBottom: "1px solid var(--line-1)" }}>
                  <Link href={`/projects/${p.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px var(--cms-panel-pad-x)", minHeight: "var(--cms-row-h)" }}>
                    <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 600 }}>{p.name}</span>
                      <span className="caption">{[p.domain, p.industry, p.locale].filter(Boolean).join(" · ")}</span>
                    </span>
                    <Badge tone="outline" title="Từ khoá">{p._count.keywords} KW</Badge>
                    <Badge tone="neutral" title="Phân tích">{p._count.analyses} <Search size={10} aria-hidden /></Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Tạo dự án mới">
          <CreateProjectForm />
        </Panel>
      </div>
    </div>
  );
}
