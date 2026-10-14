import type { ClusterNode } from "@/lib/schemas";

/** Hướng sơ đồ: LR = cây ngang (pillar trái → cluster → supporting phải), TB = cây dọc. */
export type LayoutDir = "LR" | "TB";

/** Kích thước node cố định → cột/hàng thẳng hàng tuyệt đối, cạnh nối vào đúng giữa cạnh hộp. */
export const NODE_W = 240;
export const NODE_H = 112;
/** Khoảng giữa các cột (LR) đủ chỗ cho đường gom (trunk) ở giữa + đường cong liên kết chéo. */
const GAP_DEPTH = 104;
/** Khoảng giữa các node anh em. */
const GAP_SIB_LR = 16;
const GAP_SIB_TB = 24;

const DEPTH: Record<ClusterNode["kind"], number> = { pillar: 0, cluster: 1, supporting: 2 };

export type Pos = { x: number; y: number };

/**
 * Bố cục cây gọn (tidy tree): lá xếp liên tiếp theo thứ tự, node cha nằm chính giữa dải con của nó,
 * nên các cạnh cha → con không bao giờ cắt nhau. Node mồ côi (cha không tồn tại) xếp ở cột/hàng sâu nhất, sau cùng.
 */
export function tidyLayout(nodes: ClusterNode[], dir: LayoutDir): Record<string, Pos> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, ClusterNode[]>();
  const roots: ClusterNode[] = [];
  for (const n of nodes) {
    const p = n.parentId && byId.has(n.parentId) && n.parentId !== n.id ? n.parentId : null;
    if (p) (children.get(p) ?? children.set(p, []).get(p)!).push(n);
    else roots.push(n);
  }
  // pillar trước, rồi các gốc khác (node mồ côi) — giữ thứ tự nguồn cho ổn định
  roots.sort((a, b) => DEPTH[a.kind] - DEPTH[b.kind]);

  const slot = dir === "LR" ? NODE_H + GAP_SIB_LR : NODE_W + GAP_SIB_TB; // kích thước 1 lá theo trục anh em
  const step = dir === "LR" ? NODE_W + GAP_DEPTH : NODE_H + GAP_DEPTH; // khoảng giữa 2 tầng
  const cross = new Map<string, number>(); // toạ độ tâm theo trục anh em
  const depthOf = new Map<string, number>();
  let cursor = 0;
  const seen = new Set<string>();

  const place = (n: ClusterNode, depth: number): number => {
    if (seen.has(n.id)) return cross.get(n.id) ?? 0; // phòng vòng lặp parentId
    seen.add(n.id);
    depthOf.set(n.id, Math.max(depth, DEPTH[n.kind] ?? depth));
    const kids = children.get(n.id) ?? [];
    let c: number;
    if (!kids.length) { c = cursor + slot / 2; cursor += slot; }
    else {
      const cs = kids.map((k) => place(k, depth + 1));
      c = (cs[0] + cs[cs.length - 1]) / 2;
    }
    cross.set(n.id, c);
    return c;
  };
  for (const r of roots) place(r, DEPTH[r.kind]);
  for (const n of nodes) if (!seen.has(n.id)) place(n, DEPTH[n.kind]);

  // căn giữa quanh 0 cho fitView đẹp
  const mid = cursor / 2;
  const out: Record<string, Pos> = {};
  for (const n of nodes) {
    const c = (cross.get(n.id) ?? 0) - mid;
    const d = (depthOf.get(n.id) ?? 0) * step;
    out[n.id] = dir === "LR" ? { x: Math.round(d), y: Math.round(c - NODE_H / 2) } : { x: Math.round(c - NODE_W / 2), y: Math.round(d) };
  }
  return out;
}

/** Vị trí cho node mới thêm: ngay sau anh em cuối cùng của cùng cha (hoặc cạnh cha nếu chưa có). */
export function placeNewNode(parent: Pos | undefined, siblings: Pos[], dir: LayoutDir): Pos {
  const p = parent ?? { x: 0, y: 0 };
  if (siblings.length) {
    const last = siblings.reduce((a, b) => (dir === "LR" ? (b.y > a.y ? b : a) : b.x > a.x ? b : a));
    return dir === "LR" ? { x: last.x, y: last.y + NODE_H + GAP_SIB_LR } : { x: last.x + NODE_W + GAP_SIB_TB, y: last.y };
  }
  return dir === "LR" ? { x: p.x + NODE_W + GAP_DEPTH, y: p.y } : { x: p.x, y: p.y + NODE_H + GAP_DEPTH };
}
