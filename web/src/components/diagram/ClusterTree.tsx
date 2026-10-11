import type { CSSProperties, ReactNode } from "react";
import { Network } from "lucide-react";
import { PILLAR, resolveCluster, type BranchLink, type ClusterInput, type ResolvedLink } from "./clusterLinks";
import s from "./ClusterTree.module.css";

/**
 * Sơ đồ pillar → cluster tĩnh (server component, không JS phía client).
 * - Nhánh cây: CSS thuần (border + border-radius 12px), trục dọc là ::before của danh sách → nét liền, sắc, co giãn theo bố cục.
 *   Thẻ cluster có chiều cao cố định (tiêu đề clamp 2 dòng) nên tâm từng thẻ tính được bằng CSS: tâm = H/2 + i·(H + G).
 * - < 900px: pillar ở trên, trục chạy dọc mép trái, mọi nhánh rẽ └ vào thẻ.
 *   ≥ 900px: pillar bên trái (giữa theo chiều dọc), nhánh ngang vào trục; nhánh phía trên tâm rẽ ┌, phía dưới └, giữa thẳng.
 * - Nhánh liền + mũi tên = đã có internal link giữa pillar và bài (chiều link = chiều mũi tên); nét đứt = chưa có (nên thêm).
 * - Link chéo giữa hai bài cluster (≥ 900px): đường cong SVG nét đứt màu --chart-2 ở rãnh bên phải thẻ.
 */

/** Phải khớp với ClusterTree.module.css (--ct-h, --ct-gap). */
const CARD_H = 94;
const ROW_GAP = 10;
const PITCH = CARD_H + ROW_GAP;
/** Điểm nối link chéo lệch khỏi tâm thẻ: đi ra ở nửa trên, đi vào ở nửa dưới → hai đầu không chồng nhau. */
const ARC_DY = 7;
const ARC_LANE0 = 12;
const ARC_LANE_STEP = 9;
const ARC_MAX_LANES = 4;
const ARROW = 6;

type Cross = { from: number; to: number; lane: number };

function layoutCross(cross: { from: number; to: number }[]): { arcs: Cross[]; width: number } {
  const placed: (Cross & { lo: number; hi: number })[] = [];
  const sorted = cross
    .map((c) => ({ ...c, lo: Math.min(c.from, c.to), hi: Math.max(c.from, c.to) }))
    .sort((a, b) => a.hi - a.lo - (b.hi - b.lo) || a.lo - b.lo);
  for (const c of sorted) {
    let lane = 0;
    while (lane < ARC_MAX_LANES - 1 && placed.some((p) => p.lane === lane && p.lo <= c.hi && c.lo <= p.hi)) lane++;
    placed.push({ ...c, lane });
  }
  const lanes = placed.reduce((m, p) => Math.max(m, p.lane + 1), 0);
  return { arcs: placed, width: lanes ? ARC_LANE0 + (lanes - 1) * ARC_LANE_STEP + 10 : 0 };
}

/** Đường cong từ mép phải thẻ nguồn tới mép phải thẻ đích, toạ độ tính từ đỉnh hàng nguồn. Đỉnh cong cách mép thẻ đúng `ext`. */
function arcPath(c: Cross) {
  const ys = CARD_H / 2 - ARC_DY;
  const yt = (c.to - c.from) * PITCH + CARD_H / 2 + ARC_DY;
  const ext = ARC_LANE0 + c.lane * ARC_LANE_STEP;
  const k = Math.round((ext / 0.75) * 100) / 100; // cubic với 2 điểm điều khiển cùng x=k đạt x lớn nhất = 0.75k
  return {
    d: `M0 ${ys}C${k} ${ys} ${k} ${yt} 0 ${yt}`,
    head: `M0 ${yt}L${ARROW} ${yt - 3.5}L${ARROW} ${yt + 3.5}Z`,
  };
}

const linkState = (b: BranchLink) => (b.out && b.in ? "both" : b.out ? "out" : b.in ? "in" : "none");
const LINK_SR: Record<string, string> = {
  both: "Có internal link hai chiều với pillar.",
  out: "Pillar đã có internal link tới bài này.",
  in: "Bài này có internal link về pillar.",
  none: "Chưa có internal link với pillar — nên thêm.",
};

type TreeCluster = Omit<ClusterInput, "clusters"> & { clusters: { title: string; targetKeyword: string; intent: string }[] };

export function ClusterTree({ cluster, badge }: { cluster: TreeCluster; badge?: (intent: string) => ReactNode }) {
  const n = cluster.clusters.length;
  const { branches, links, cross } = resolveCluster(cluster);
  const { arcs, width } = layoutCross(cross);
  const linked = branches.filter((b) => b.out || b.in).length;
  const mid = (n - 1) / 2;

  return (
    <div className={s.wrap}>
      <div className={s.tree} style={{ "--ct-arcs-w": `${width}px` } as CSSProperties}>
        <div className={s.pillar}>
          <span className={s.pillarLabel}><Network size={12} aria-hidden /> Pillar</span>
          <span className={s.pillarTitle} title={cluster.pillar}>{cluster.pillar}</span>
          {n > 0 && <span className={s.pillarFoot}><span className="mono">{linked}/{n}</span> bài đã nối link với pillar</span>}
        </div>
        {n > 0 && (
          <>
            <span className={s.stub} aria-hidden />
            <ol className={s.rows} data-single={n === 1 ? "" : undefined} aria-label={`Bài cluster · ${n}`}>
              {cluster.clusters.map((x, i) => {
                const state = linkState(branches[i]);
                const out = arcs.filter((a) => a.from === i);
                return (
                  <li key={x.title + x.targetKeyword + i} className={s.row} data-pos={i < mid ? "up" : i > mid ? "down" : "mid"} data-link={state}>
                    <span className={s.branch} aria-hidden />
                    <div className={s.card} tabIndex={0}>
                      <span className={s.cardTitle} title={x.title}>{x.title}</span>
                      <span className={s.cardMeta}>
                        <span className={s.kw} title={x.targetKeyword}>{x.targetKeyword}</span>
                        {badge && <span className={s.badge}>{badge(x.intent)}</span>}
                        {state === "both" && <span className={s.both} title="Link hai chiều với pillar" aria-hidden>↔</span>}
                      </span>
                      <span className="sr-only">{LINK_SR[state]}</span>
                    </div>
                    {out.length > 0 && (
                      <svg className={s.arcs} width={width} height={CARD_H} aria-hidden focusable="false">
                        {out.map((a) => {
                          const p = arcPath(a);
                          return (
                            <g key={`${a.from}-${a.to}`} className={s.arc}>
                              <path d={p.d} className={s.arcLine} />
                              <path d={p.head} className={s.arcHead} />
                            </g>
                          );
                        })}
                      </svg>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>

      {n > 0 && (
        <ul className={s.legend} aria-label="Chú giải sơ đồ">
          <li><svg width="24" height="8" aria-hidden focusable="false"><path d="M0 4H18" className={s.lgSolid} /><path d="M18 0.5L24 4L18 7.5Z" className={s.lgHead} /></svg>Đã có internal link</li>
          <li><svg width="24" height="8" aria-hidden focusable="false"><path d="M0 4H24" className={s.lgDashed} /></svg>Nên thêm link</li>
          {arcs.length > 0 && <li className={s.onlyWide}><svg width="24" height="10" aria-hidden focusable="false"><path d="M6 1C20 1 20 9 6 9" className={s.lgCross} /><path d="M0 9L6 5.5L6 12.5Z" className={s.lgCrossHead} /></svg>Link chéo giữa các bài</li>}
        </ul>
      )}

      {links.length > 0 && <LinkList links={links} />}
    </div>
  );
}

function Glyph({ kind }: { kind: ResolvedLink["kind"] }) {
  return (
    <svg className={s.glyph} data-kind={kind} width="24" height="8" viewBox="0 0 24 8" aria-hidden focusable="false">
      <path d="M0 4H18" className={s.glyphLine} />
      <path d="M18 0.5L24 4L18 7.5Z" className={s.glyphHead} />
    </svg>
  );
}

const KIND_SR: Record<ResolvedLink["kind"], string> = { hierarchy: "link pillar", cross: "link chéo", unknown: "link" };

function LinkList({ links }: { links: ResolvedLink[] }) {
  return (
    <div className={s.links}>
      <div className={s.linksHead}>Internal link đề xuất · <span className="mono">{links.length}</span></div>
      <ul className={s.linkList}>
        {links.map((l, i) => (
          <li key={i} className={s.link}>
            <span className={s.from} data-pillar={l.from === PILLAR ? "" : undefined}>{l.fromLabel}</span>
            <Glyph kind={l.kind} />
            <span className="sr-only">{KIND_SR[l.kind]} tới</span>
            <span className={s.to} data-pillar={l.to === PILLAR ? "" : undefined}>{l.toLabel}</span>
            <span className={s.anchorCell}><span className={s.anchor}>“{l.anchor}”</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
