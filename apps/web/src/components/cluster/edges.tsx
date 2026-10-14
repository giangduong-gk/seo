"use client";

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useInternalNode, useReactFlow, useStore, type Edge, type EdgeProps, type InternalNode } from "@xyflow/react";
import { memo, useState } from "react";
import { NODE_H, NODE_W, type LayoutDir } from "./layout";
import type { TopicNodeType } from "./TopicNode";

/*
 * Ngôn ngữ đường nối của sơ đồ Topic Cluster
 * ─ Cạnh cây (cha → con): đường vuông góc bo góc 12px, các con của một cha dùng chung một "trục" (bus) → không cắt nhau.
 *     liền + mũi tên  = đã có internal link theo chiều đó (hai đầu mũi tên = link hai chiều, gộp thành 1 đường)
 *     nét đứt        = quan hệ cha–con nhưng CHƯA có internal link (gợi ý cần bổ sung)
 * ─ Liên kết chéo (không phải cha–con): đường cong nét đứt màu chart-2, mờ; cùng cột thì uốn sát mép phải
 *   (cây ngang) / mép dưới (cây dọc) trong khoảng trống giữa node và trục, lệch làn để không chồng nhau.
 * Nhãn anchor chỉ hiện cạnh con trỏ khi rê chuột vào đường (anchor đầy đủ ở khung "Internal link" bên phải).
 */

export type FlowLink = Edge<{ why: string | null }>; // 1 internal link (nguồn dữ liệu, không vẽ trực tiếp)
type EdgeData = { dir: LayoutDir; labels: string[]; lane: number };
export type TreeEdgeType = Edge<EdgeData, "tree">;
export type CrossEdgeType = Edge<EdgeData, "cross">;
export type ViewEdge = TreeEdgeType | CrossEdgeType;

/* ───────── Dựng danh sách cạnh hiển thị từ cây + internal link ───────── */

export function buildViewEdges(nodes: TopicNodeType[], links: FlowLink[], o: { dir: LayoutDir; selectedId: string | null; hoverId: string | null; showCross: boolean }): ViewEdge[] {
  const ids = new Set(nodes.map((n) => n.id));
  const depth = new Map(nodes.map((n) => [n.id, n.data.node.kind === "pillar" ? 0 : n.data.node.kind === "cluster" ? 1 : 2]));
  const key = (a: string, b: string) => `${a}\u0000${b}`;
  const linkMap = new Map(links.map((l) => [key(l.source, l.target), l]));
  const used = new Set<string>();
  const out: ViewEdge[] = [];

  const state = (a: string, b: string) => {
    const on = o.selectedId != null && (a === o.selectedId || b === o.selectedId);
    const hover = o.hoverId != null && (a === o.hoverId || b === o.hoverId);
    return { on, hover, cls: on ? " ce-hl" : o.selectedId ? " ce-dim" : hover ? " ce-hover" : "" };
  };
  const label = (l?: FlowLink) => (l?.label ? String(l.label) : "");

  // 1) Cạnh cây
  for (const n of nodes) {
    const p = n.data.node.parentId;
    if (!p || p === n.id || !ids.has(p)) continue;
    const fwd = linkMap.get(key(p, n.id)), back = linkMap.get(key(n.id, p));
    if (fwd) used.add(key(p, n.id));
    if (back) used.add(key(n.id, p));
    const st = state(p, n.id);
    const mk = st.on ? "ce-arrow-hl" : "ce-arrow";
    out.push({
      id: `tree:${p}>${n.id}`, type: "tree", source: p, target: n.id, selectable: false, focusable: false,
      className: `ce-tree${fwd || back ? "" : " ce-missing"}${st.cls}`,
      markerEnd: fwd ? mk : undefined, markerStart: back ? mk : undefined, zIndex: st.on ? 2 : st.hover ? 1 : 0,
      data: { dir: o.dir, lane: 0, labels: [fwd ? label(fwd) : "", back ? `← ${label(back)}` : ""].filter(Boolean) },
    });
  }

  // 2) Liên kết chéo — gộp cặp hai chiều thành một đường hai đầu mũi tên
  const laneCount = new Map<string, number>();
  for (const l of links) {
    const k = key(l.source, l.target);
    if (used.has(k) || !ids.has(l.source) || !ids.has(l.target) || l.source === l.target) continue;
    const rev = linkMap.get(key(l.target, l.source));
    used.add(k); if (rev) used.add(key(l.target, l.source));
    const st = state(l.source, l.target);
    if (!o.showCross && !st.on) continue;
    const group = `${depth.get(l.source)}-${depth.get(l.target)}`;
    const lane = laneCount.get(group) ?? 0; laneCount.set(group, lane + 1);
    const mk = st.on ? "ce-arrow-hl" : "ce-arrow-x";
    out.push({
      id: `x:${l.source}>${l.target}`, type: "cross", source: l.source, target: l.target, selectable: false, focusable: false,
      className: `ce-cross${st.cls}`, markerEnd: mk, markerStart: rev ? mk : undefined, zIndex: st.on ? 2 : st.hover ? 1 : 0,
      data: { dir: o.dir, lane: lane % 3, labels: [label(l), rev ? `← ${label(rev)}` : ""].filter(Boolean) },
    });
  }
  return out;
}

/* ───────── Nhãn anchor (HTML, nằm trên cùng) ───────── */

const zoomSel = (s: { transform: [number, number, number] }) => s.transform[2];

/**
 * Nhãn anchor hiện cạnh con trỏ khi rê vào đường (một nhãn mỗi lúc → không chồng lên node).
 * Toạ độ theo hệ sơ đồ; scale(1/zoom) quanh góc trên-trái để cỡ chữ cố định trên màn hình.
 */
function CursorLabel({ at, labels }: { at: { x: number; y: number } | null; labels: string[] }) {
  const zoom = useStore(zoomSel);
  if (!at || !labels.length) return null;
  return (
    <EdgeLabelRenderer>
      <div className="ce-label nodrag nopan" style={{ transform: `translate(${at.x}px, ${at.y}px) scale(${1 / Math.max(zoom, 0.05)}) translate(12px, -100%) translate(0, -8px)` }}>
        {labels.map((s, i) => <span key={i}>{s}</span>)}
      </div>
    </EdgeLabelRenderer>
  );
}

/** Vùng bắt chuột rộng 16px dọc theo đường (đường thật chỉ 1.5px); trả vị trí con trỏ theo toạ độ sơ đồ. */
function useHover() {
  const { screenToFlowPosition } = useReactFlow();
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const hit = (d: string) => (
    <path
      d={d} fill="none" stroke="transparent" strokeWidth={16} className="ce-hit"
      onMouseMove={(e) => setAt(screenToFlowPosition({ x: e.clientX, y: e.clientY }))}
      onMouseLeave={() => setAt(null)}
    />
  );
  return { at, hit };
}

/* ───────── Cạnh cây: vuông góc bo góc ───────── */

function TreeEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, markerStart, data }: EdgeProps<TreeEdgeType>) {
  const { at, hit } = useHover();
  const [path] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 12, offset: 16 });
  const labels = data?.labels.length ? data.labels : ["Chưa có internal link — kéo từ node cha để tạo"];
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} markerStart={markerStart} interactionWidth={0} />
      {hit(path)}
      <CursorLabel at={at} labels={labels} />
    </>
  );
}
export const TreeEdge = memo(TreeEdgeView);

/* ───────── Liên kết chéo: đường cong tự chọn mép gần nhất ───────── */

type Box = { x: number; y: number; w: number; h: number };
const box = (n: InternalNode<TopicNodeType>): Box => ({ x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, w: n.measured?.width ?? NODE_W, h: n.measured?.height ?? NODE_H });

/** Điểm đầu/cuối lệch khỏi tâm cạnh (22% / 78%) để không đè lên chỗ cạnh cây đi vào/ra. */
function crossPath(a: Box, b: Box, dir: LayoutDir, lane: number): { d: string; mx: number; my: number } {
  const bulge = 30 + lane * 12; // đỉnh cong ≈ 0.75·bulge → luôn nằm trong nửa khoảng trống trước trục
  let sx: number, sy: number, tx: number, ty: number, c1x: number, c1y: number, c2x: number, c2y: number;
  if (dir === "LR") {
    const down = b.y + b.h / 2 > a.y + a.h / 2;
    sy = a.y + a.h * (down ? 0.78 : 0.22); ty = b.y + b.h * (down ? 0.22 : 0.78);
    if (Math.abs(a.x - b.x) < a.w / 2) { // cùng cột → uốn ra mép phải
      sx = a.x + a.w; tx = b.x + b.w; c1x = sx + bulge; c2x = tx + bulge; c1y = sy; c2y = ty;
    } else if (b.x > a.x) { sx = a.x + a.w; tx = b.x; const dx = (tx - sx) / 2; c1x = sx + dx; c2x = tx - dx; c1y = sy; c2y = ty; }
    else { sx = a.x; tx = b.x + b.w; const dx = (sx - tx) / 2; c1x = sx - dx; c2x = tx + dx; c1y = sy; c2y = ty; }
  } else {
    const right = b.x + b.w / 2 > a.x + a.w / 2;
    sx = a.x + a.w * (right ? 0.78 : 0.22); tx = b.x + b.w * (right ? 0.22 : 0.78);
    if (Math.abs(a.y - b.y) < a.h / 2) { // cùng hàng → uốn xuống mép dưới
      sy = a.y + a.h; ty = b.y + b.h; c1y = sy + bulge; c2y = ty + bulge; c1x = sx; c2x = tx;
    } else if (b.y > a.y) { sy = a.y + a.h; ty = b.y; const dy = (ty - sy) / 2; c1y = sy + dy; c2y = ty - dy; c1x = sx; c2x = tx; }
    else { sy = a.y; ty = b.y + b.h; const dy = (sy - ty) / 2; c1y = sy - dy; c2y = ty + dy; c1x = sx; c2x = tx; }
  }
  const r = (v: number) => Math.round(v * 10) / 10;
  // điểm giữa đường cong Bézier bậc 3 (t = 0.5) cho nhãn
  const mx = 0.125 * sx + 0.375 * c1x + 0.375 * c2x + 0.125 * tx;
  const my = 0.125 * sy + 0.375 * c1y + 0.375 * c2y + 0.125 * ty;
  return { d: `M ${r(sx)} ${r(sy)} C ${r(c1x)} ${r(c1y)}, ${r(c2x)} ${r(c2y)}, ${r(tx)} ${r(ty)}`, mx, my };
}

function CrossEdgeView({ id, source, target, markerEnd, markerStart, data }: EdgeProps<CrossEdgeType>) {
  const { at, hit } = useHover();
  const s = useInternalNode<TopicNodeType>(source), t = useInternalNode<TopicNodeType>(target);
  if (!s || !t) return null;
  const { d } = crossPath(box(s), box(t), data?.dir ?? "LR", data?.lane ?? 0);
  return (
    <>
      <BaseEdge id={id} path={d} markerEnd={markerEnd} markerStart={markerStart} interactionWidth={0} />
      {hit(d)}
      <CursorLabel at={at} labels={data?.labels ?? []} />
    </>
  );
}
export const CrossEdge = memo(CrossEdgeView);

export const edgeTypes = { tree: TreeEdge, cross: CrossEdge };

/** Định nghĩa mũi tên dùng chung (màu theo token qua CSS class). Đặt một lần trong editor. */
export function EdgeMarkers() {
  const mk = (id: string, cls: string) => (
    <marker key={id} id={id} viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
      <path d="M 0.5 1 L 9.5 5 L 0.5 9 Z" className={cls} />
    </marker>
  );
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
      <defs>{mk("ce-arrow", "ce-mk")}{mk("ce-arrow-hl", "ce-mk-hl")}{mk("ce-arrow-x", "ce-mk-x")}</defs>
    </svg>
  );
}
