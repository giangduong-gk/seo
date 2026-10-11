/**
 * Ghép internal link (model viết tên ngắn: "Pillar giá S26 Ultra", "Trả góp 0% Galaxy S26 Ultra") với pillar / bài cluster.
 * So khớp mờ: bỏ dấu, không phân biệt hoa thường, theo tỉ lệ token của tên ngắn có trong tiêu đề. Thuần TS, chạy được ở server.
 */

export type ClusterInput = { pillar: string; clusters: { title: string }[]; internalLinks: { from: string; to: string; anchor: string }[] };

/** -1 = pillar, 0..n-1 = chỉ số bài cluster, null = không khớp. */
export type NodeRef = number | null;
export const PILLAR = -1;

export type BranchLink = { out: boolean; in: boolean };
export type ResolvedLink = { from: NodeRef; to: NodeRef; anchor: string; fromLabel: string; toLabel: string; kind: "hierarchy" | "cross" | "unknown" };

const MIN_SCORE = 0.6;

export function normalize(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const tokens = (s: string) => normalize(s).split(" ").filter(Boolean);

/** Điểm khớp tên ngắn `name` với tiêu đề `title`: [độ phủ tên, độ phủ tiêu đề] — so sánh theo thứ tự từ điển. */
function score(name: string[], title: string): [number, number] {
  if (!name.length) return [0, 0];
  const t = tokens(title);
  const set = new Set(t);
  const hit = name.filter((x) => set.has(x)).length;
  const contained = ` ${t.join(" ")} `.includes(` ${name.join(" ")} `);
  return [contained ? 1.01 : hit / name.length, t.length ? hit / t.length : 0];
}

export function resolveNode(name: string, pillar: string, titles: string[]): NodeRef {
  const raw = tokens(name);
  const isPillarWord = raw.includes("pillar");
  const name2 = raw.filter((x) => x !== "pillar");
  if (isPillarWord) return PILLAR;
  let best: NodeRef = null;
  let bestScore: [number, number] = [MIN_SCORE - 1e-9, -1];
  const consider = (ref: number, title: string) => {
    const s = score(name2, title);
    if (s[0] > bestScore[0] || (s[0] === bestScore[0] && s[1] > bestScore[1])) { best = ref; bestScore = s; }
  };
  titles.forEach((t, i) => consider(i, t));
  consider(PILLAR, pillar);
  return best;
}

export function resolveCluster(c: ClusterInput) {
  const titles = c.clusters.map((x) => x.title);
  const branches: BranchLink[] = titles.map(() => ({ out: false, in: false }));
  const links: ResolvedLink[] = c.internalLinks.map((l) => {
    const from = resolveNode(l.from, c.pillar, titles);
    const to = resolveNode(l.to, c.pillar, titles);
    let kind: ResolvedLink["kind"] = "unknown";
    if (from !== null && to !== null && from !== to) {
      if (from === PILLAR && to >= 0) { branches[to].out = true; kind = "hierarchy"; }
      else if (to === PILLAR && from >= 0) { branches[from].in = true; kind = "hierarchy"; }
      else if (from >= 0 && to >= 0) kind = "cross";
    }
    return { from, to, anchor: l.anchor, fromLabel: l.from, toLabel: l.to, kind };
  });
  const cross = links.filter((l): l is ResolvedLink & { from: number; to: number } => l.kind === "cross");
  return { branches, links, cross };
}
