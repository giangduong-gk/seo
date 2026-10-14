import { ArrowRight, Clock, FileText, FolderPlus, Network, PenLine, Plus, Search } from "lucide-react";
import Link from "next/link";
import { EmptyState, Panel, SystemNotice } from "@/components/ui";
import { hasApiKey } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { CreateProjectForm } from "./CreateProjectForm";
import s from "./page.module.css";

export const dynamic = "force-dynamic";

const rtf = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });
/** "3 giờ trước", "hôm qua", "2 tuần trước"… */
function relative(d: Date, now = Date.now()): string {
  const sec = Math.round((d.getTime() - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 45) return "vừa xong";
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["minute", 60], ["hour", 3600], ["day", 86400], ["week", 604800], ["month", 2629800], ["year", 31557600]];
  let unit: Intl.RelativeTimeFormatUnit = "minute", div = 60;
  for (const [u, n] of steps) { if (abs >= n) { unit = u; div = n; } }
  return rtf.format(Math.round(sec / div), unit);
}

const STEPS = [
  { icon: Search, title: "Phân tích từ khoá", text: "Ý định, SERP, từ khoá ngữ nghĩa, thực thể." },
  { icon: Network, title: "Topic Cluster", text: "Bản đồ pillar – cluster, cảnh báo trùng lặp." },
  { icon: FileText, title: "Content Brief", text: "Outline answer-first, E-E-A-T, schema." },
  { icon: PenLine, title: "Viết & chấm điểm", text: "Claude viết trực tiếp, chấm SEO/GEO." },
];

export default async function HomePage() {
  const [projects, usage] = await Promise.all([
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { keywords: true, analyses: true, clusters: true, briefs: true, articles: true } } },
    }),
    prisma.aiUsage.groupBy({ by: ["projectId"], _sum: { costUsd: true }, _max: { createdAt: true } }),
  ]);
  const usageOf = new Map(usage.map((u) => [u.projectId, u]));
  const now = Date.now();
  const hasProjects = projects.length > 0;

  return (
    <div className="container stack">
      <header className="page-head page-in">
        <div className="micro">RankMind</div>
        <h1 className="display">Dự án</h1>
        <p className="sub">Từ khoá → topic cluster → brief → bài viết chuẩn SEO/GEO 2026, gom trong một dự án.</p>
        {hasProjects && (
          <div className={["actions", s.headAction].join(" ")}>
            <a href="#tao-du-an" className={s.newBtn}><Plus size={16} aria-hidden /> Dự án mới</a>
          </div>
        )}
      </header>

      {!hasApiKey() && (
        <SystemNotice tone="amber" title="Chưa cấu hình ANTHROPIC_API_KEY">
          Thêm khoá vào <code className="mono">apps/web/.env</code> rồi khởi động lại. Bạn vẫn tạo được dự án nhưng chưa chạy phân tích được.
        </SystemNotice>
      )}

      {projects.length < 2 && (
        <section aria-labelledby="cach-dung" className={s.steps}>
          <h2 id="cach-dung" className="micro">Cách dùng</h2>
          <ol className={[s.stepList, "page-in"].join(" ")}>
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className={s.step}>
                <span className={s.stepNum} aria-hidden>{i + 1}</span>
                <span className={s.stepBody}>
                  <span className={s.stepTitle}><Icon size={14} aria-hidden /> {title}</span>
                  <span className={s.stepText}>{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="two-col wide-aside">
        <section aria-labelledby="du-an-hien-co" className="stack" style={{ gap: "var(--space-3)" }}>
          <div className={s.sectionHead}>
            <h2 id="du-an-hien-co" className="h3">Dự án hiện có</h2>
            <span className="caption mono">{projects.length}</span>
          </div>
          {!hasProjects ? (
            <Panel>
              <EmptyState
                icon={<FolderPlus size={22} />}
                title="Chưa có dự án"
                text="Tạo dự án đầu tiên — chỉ cần tên và domain là bắt đầu phân tích được."
                action={<a href="#tao-du-an" className={[s.newBtn, s.onlyStacked].join(" ")}><Plus size={16} aria-hidden /> Tạo dự án</a>}
              />
            </Panel>
          ) : (
            <ul className={["stagger", s.grid].join(" ")}>
              {projects.map((p) => {
                const u = usageOf.get(p.id);
                const last = new Date(Math.max(p.updatedAt.getTime(), u?._max.createdAt?.getTime() ?? 0));
                const meta = [p.domain, p.industry, p.locale].filter(Boolean).join(" · ");
                const stats = [
                  ["Từ khoá", p._count.keywords],
                  ["Phân tích", p._count.analyses],
                  ["Cluster", p._count.clusters],
                  ["Brief", p._count.briefs],
                  ["Bài viết", p._count.articles],
                ] as const;
                return (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className={["card-hover", s.card].join(" ")}>
                      <span className={s.cardHead}>
                        <span className={s.cardTitle}>{p.name}</span>
                        <ArrowRight size={16} className={s.cardArrow} aria-hidden />
                      </span>
                      {meta && <span className={s.cardMeta}>{meta}</span>}
                      <dl className={s.stats}>
                        {stats.map(([label, n]) => (
                          <div key={label} className={s.statCell}>
                            <dt>{label}</dt>
                            <dd className={n === 0 ? s.zero : undefined}>{n}</dd>
                          </div>
                        ))}
                      </dl>
                      <span className={s.cardFoot}>
                        <span className={s.footItem}><Clock size={12} aria-hidden /> <time dateTime={last.toISOString()} title={last.toLocaleString("vi-VN")}>{relative(last, now)}</time></span>
                        <span className={s.cost} title="Chi phí AI ước tính">${(u?._sum.costUsd ?? 0).toFixed(3)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside aria-label="Tạo dự án mới">
          <Panel title="Tạo dự án mới" id="tao-du-an" className={s.formPanel}>
            <CreateProjectForm />
          </Panel>
        </aside>
      </div>
    </div>
  );
}
