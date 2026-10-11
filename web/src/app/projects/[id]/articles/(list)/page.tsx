import { ChevronRight, PenLine } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, EmptyState, Panel, SystemNotice, type BadgeTone } from "@/components/ui";
import { hasApiKey } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { wordCount } from "@/lib/markdown";
import { STATUS_LABEL, scoreTone } from "@/components/article/status";
import { ProjectHeader } from "../../ProjectHeader";
import { ArticleForm } from "../ArticleForm";
import c from "./articles.module.css";
import { relTime } from "./relTime";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const FILTERS = ["all", "draft", "writing", "review", "final"] as const;
type Filter = (typeof FILTERS)[number];
const nf = new Intl.NumberFormat("vi-VN");

function Mini({ label, v }: { label: string; v: number }) {
  return (
    <span className={c.mini} title={`Điểm ${label}: ${v}/100`}>
      <span>{label}</span>
      <span className={c.miniTrack}><span className={[c.miniFill, c[scoreTone(v)], "grow-x"].join(" ")} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></span>
      <span className={c.miniNum}>{v}</span>
    </span>
  );
}

export default async function ArticlesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      briefs: { orderBy: { createdAt: "desc" }, select: { id: true, title: true, targetKeyword: true } },
      articles: { orderBy: { updatedAt: "desc" }, include: { scores: { orderBy: { createdAt: "desc" }, take: 1, select: { seoScore: true, geoScore: true } } } },
    },
  });
  if (!project) notFound();
  const canGenerate = hasApiKey();
  const raw = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const filter: Filter = (FILTERS as readonly string[]).includes(raw ?? "") ? (raw as Filter) : "all";
  const counts = Object.fromEntries(FILTERS.map((f) => [f, f === "all" ? project.articles.length : project.articles.filter((a) => a.status === f).length])) as Record<Filter, number>;
  const shown = filter === "all" ? project.articles : project.articles.filter((a) => a.status === filter);
  const now = new Date();
  const base = `/projects/${id}/articles`;

  return (
    <div className="container stack page-in">
      <ProjectHeader projectId={id} active="articles" trail="Bài viết" />
      {!canGenerate && <SystemNotice tone="amber" title="Chưa cấu hình ANTHROPIC_API_KEY">Thêm khoá vào <code className="mono">web/.env</code> để Claude viết và chấm điểm bài. Vẫn soạn thảo thủ công được.</SystemNotice>}
      <div className={c.layout}>
        <div className={c.formCol}>
          <Panel title="Viết bài mới" sub="streaming · chấm SEO/GEO · JSON-LD">
            <ArticleForm projectId={id} briefs={project.briefs} disabled={!canGenerate} />
          </Panel>
        </div>
        <Panel title="Bài viết" sub={filter === "all" ? `${project.articles.length}` : `${shown.length}/${project.articles.length}`} flush>
          {project.articles.length === 0 ? (
            <EmptyState icon={<PenLine size={22} />} title="Chưa có bài viết" text="Chọn một brief (hoặc nhập từ khoá) rồi bấm “Viết bài” — Claude viết trực tiếp vào trình soạn thảo." />
          ) : (
            <>
              <nav className={["scroll-x", "fade-x", c.filters].join(" ")} aria-label="Lọc theo trạng thái">
                {FILTERS.filter((f) => f === "all" || counts[f] > 0 || f === filter).map((f) => (
                  <Link key={f} href={f === "all" ? base : `${base}?status=${f}`} scroll={false} replace className={[c.chip, filter === f ? c.chipOn : "", counts[f] === 0 ? c.chipEmpty : ""].join(" ")} aria-current={filter === f ? "true" : undefined}>
                    {f === "all" ? "Tất cả" : STATUS_LABEL[f]?.label ?? f}<span className={c.count}>{counts[f]}</span>
                  </Link>
                ))}
              </nav>
              {shown.length === 0 ? (
                <p className="caption" style={{ padding: "20px var(--cms-panel-pad-x)" }}>Không có bài nào ở trạng thái này. <Link href={base} style={{ textDecoration: "underline" }}>Xem tất cả</Link></p>
              ) : (
                <ul className={["stagger", c.list].join(" ")}>
                  {shown.map((a) => {
                    const st = STATUS_LABEL[a.status] ?? { label: a.status, tone: "outline" as BadgeTone };
                    const sc = a.scores[0];
                    const words = wordCount(a.bodyMarkdown);
                    return (
                      <li key={a.id}>
                        <Link href={`${base}/${a.id}`} className={["row-link", c.row].join(" ")}>
                          <span className={c.main}>
                            <span className={c.title}>{a.title}</span>
                            <span className={c.meta}>
                              <span className={c.kw}>{a.targetKeyword}</span>
                              <span aria-hidden>·</span>
                              <time dateTime={a.updatedAt.toISOString()} title={a.updatedAt.toLocaleString("vi-VN")}>{relTime(a.updatedAt, now)}</time>
                              <span aria-hidden>·</span>
                              <span>{words ? `${nf.format(words)} từ` : "chưa có nội dung"}</span>
                            </span>
                          </span>
                          <span className={c.side}>
                            {sc ? <span className={c.scores}><Mini label="SEO" v={sc.seoScore} /><Mini label="GEO" v={sc.geoScore} /></span> : <span className={c.noScore}>chưa chấm</span>}
                            <Badge tone={st.tone}>{st.label}</Badge>
                          </span>
                          <ChevronRight size={16} className={["row-arrow", c.arrow].join(" ")} aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
