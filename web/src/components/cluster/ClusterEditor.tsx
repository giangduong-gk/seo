"use client";

import "@xyflow/react/dist/style.css";
import { Background, Controls, MiniMap, ReactFlow, addEdge, useEdgesState, useNodesState, type Connection, type Edge, type NodeMouseHandler, type OnConnect } from "@xyflow/react";
import { Link2, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { saveClusterMap } from "@/app/actions";
import { BriefForm } from "@/app/projects/[id]/briefs/BriefForm";
import { Badge, Button, Panel, SystemNotice, Table } from "@/components/ui";
import { detectKeywordOverlap } from "@/lib/overlap";
import type { ClusterNode, StoredClusterMap } from "@/lib/schemas";
import s from "./ClusterEditor.module.css";
import { TopicNode, type TopicNodeType } from "./TopicNode";

const nodeTypes = { topic: TopicNode };
const INTENTS = ["informational", "commercial", "transactional", "navigational", "mixed"] as const;
const PRIORITIES = ["high", "medium", "low"] as const;

/** Bố cục phân tầng: pillar trên cùng, cluster hàng giữa, supporting dưới cluster cha. Cạnh nối từ đáy node cha xuống đỉnh node con. */
const NODE_W = 240, GAP_X = 36, GAP_Y = 150;
function tieredLayout(nodes: ClusterNode[]): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  const pillar = nodes.find((n) => n.kind === "pillar");
  const clusters = nodes.filter((n) => n.kind === "cluster");
  const kidsOf = (id: string) => nodes.filter((n) => n.kind === "supporting" && n.parentId === id);
  const widthOf = (c: ClusterNode) => Math.max(1, kidsOf(c.id).length) * (NODE_W + GAP_X);
  const total = clusters.reduce((acc, c) => acc + widthOf(c), 0);
  let x = -total / 2;
  for (const c of clusters) {
    const w = widthOf(c);
    pos[c.id] = { x: x + w / 2 - NODE_W / 2, y: GAP_Y + 60 };
    const kids = kidsOf(c.id);
    kids.forEach((k, j) => { pos[k.id] = { x: x + j * (NODE_W + GAP_X), y: 2 * (GAP_Y + 60) }; });
    x += w;
  }
  if (pillar) pos[pillar.id] = { x: -NODE_W / 2, y: 0 };
  // node mồ côi (supporting không có cha hợp lệ) xếp hàng cuối
  let ox = -total / 2;
  nodes.forEach((n) => { if (!pos[n.id]) { pos[n.id] = { x: ox, y: 3 * (GAP_Y + 60) }; ox += NODE_W + GAP_X; } });
  return pos;
}

function toFlowNodes(map: StoredClusterMap, briefs: Record<string, string>): TopicNodeType[] {
  const layout = tieredLayout(map.nodes);
  return map.nodes.map((n) => ({
    id: n.id,
    type: "topic",
    position: map.positions?.[n.id] ?? layout[n.id],
    data: { node: n, hasBrief: Boolean(briefs[n.targetKeyword.toLowerCase()]) },
  }));
}

function toFlowEdges(map: StoredClusterMap): Edge[] {
  return map.links.map((l) => ({ id: `${l.fromId}->${l.toId}`, source: l.fromId, target: l.toId, label: l.anchor, data: { why: l.why } }));
}

type Props = { projectId: string; clusterId: string; initial: StoredClusterMap; model: string; canGenerate: boolean; briefsByKeyword: Record<string, string> };

export function ClusterEditor({ projectId, clusterId, initial, model, canGenerate, briefsByKeyword }: Props) {
  const [meta, setMeta] = useState({ pillarTitle: initial.pillarTitle, pillarKeyword: initial.pillarKeyword, strategy: initial.strategy, cannibalization: initial.cannibalization });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const init = useMemo(() => ({ nodes: toFlowNodes(initial, briefsByKeyword), edges: toFlowEdges(initial) }), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<TopicNodeType>(init.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(init.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const topicNodes = useMemo(() => nodes.map((n) => n.data.node), [nodes]);
  const selected = nodes.find((n) => n.id === selectedId)?.data.node ?? null;
  const overlaps = useMemo(() => detectKeywordOverlap(topicNodes.map((n) => ({ term: n.targetKeyword, intent: n.intent }))), [topicNodes]);

  useEffect(() => { if (saveMsg) { const t = setTimeout(() => setSaveMsg(null), 2500); return () => clearTimeout(t); } }, [saveMsg]);

  const markDirty = () => { setDirty(true); setSaveMsg(null); };

  const updateNode = (id: string, patch: Partial<ClusterNode>) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, node: { ...n.data.node, ...patch }, hasBrief: patch.targetKeyword ? Boolean(briefsByKeyword[patch.targetKeyword.toLowerCase()]) : n.data.hasBrief } } : n)));
    markDirty();
  };

  const addNode = (kind: "cluster" | "supporting", parentId: string) => {
    const base = kind === "cluster" ? "c" : `${parentId}-s`;
    let i = 1; while (nodes.some((n) => n.id === `${base}${i}`)) i++;
    const id = `${base}${i}`;
    const parent = nodes.find((n) => n.id === parentId);
    const node: ClusterNode = { id, kind, parentId, title: kind === "cluster" ? "Bài cluster mới" : "Bài supporting mới", targetKeyword: "từ khoá mục tiêu", intent: "informational", summary: "", secondaryKeywords: [], format: "guide", priority: "medium" };
    const p = parent?.position ?? { x: 0, y: 0 };
    setNodes((ns) => [...ns, { id, type: "topic", position: { x: p.x + (kind === "cluster" ? 280 : 0), y: p.y + (kind === "cluster" ? 0 : 210) }, data: { node, hasBrief: false } }]);
    setEdges((es) => [...es, { id: `${parentId}->${id}`, source: parentId, target: id, label: node.title, data: { why: null } }]);
    setSelectedId(id);
    markDirty();
  };

  const removeNode = (id: string) => {
    const target = nodes.find((n) => n.id === id)?.data.node;
    if (!target || target.kind === "pillar") return;
    setNodes((ns) => ns.filter((n) => n.id !== id).map((n) => (n.data.node.parentId === id ? { ...n, data: { ...n.data, node: { ...n.data.node, parentId: target.parentId } } } : n)));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    setSelectedId(null);
    markDirty();
  };

  const onConnect: OnConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    const target = nodes.find((n) => n.id === c.target)?.data.node;
    setEdges((es) => addEdge({ ...c, id: `${c.source}->${c.target}`, label: target?.title ?? "", data: { why: null } }, es));
    markDirty();
  }, [nodes, setEdges]);

  const onNodeClick: NodeMouseHandler<TopicNodeType> = useCallback((_, n) => setSelectedId(n.id), []);

  const setEdgeAnchor = (id: string, anchor: string) => { setEdges((es) => es.map((e) => (e.id === id ? { ...e, label: anchor } : e))); markDirty(); };
  const removeEdge = (id: string) => { setEdges((es) => es.filter((e) => e.id !== id)); markDirty(); };

  const save = () => {
    const data: StoredClusterMap = {
      ...meta,
      nodes: topicNodes,
      links: edges.map((e) => ({ fromId: e.source, toId: e.target, anchor: String(e.label ?? ""), why: (e.data as { why?: string | null } | undefined)?.why ?? null })),
      positions: Object.fromEntries(nodes.map((n) => [n.id, n.position])),
    };
    startTransition(async () => {
      const r = await saveClusterMap(clusterId, data);
      if (r.ok) { setDirty(false); setSaveMsg("Đã lưu"); } else setSaveMsg(`Lỗi: ${r.error}`);
    });
  };

  const titleOf = (id: string) => nodes.find((n) => n.id === id)?.data.node.title ?? id;
  const selectedEdges = selected ? edges.filter((e) => e.source === selected.id || e.target === selected.id) : [];
  const existingBrief = selected ? briefsByKeyword[selected.targetKeyword.toLowerCase()] : undefined;

  return (
    <div className="stack">
      <div className="row-head">
        <div className="text">
          <div className="micro">Topic Cluster · {model}</div>
          <input className="h1" value={meta.pillarTitle} onChange={(e) => { setMeta({ ...meta, pillarTitle: e.target.value }); markDirty(); }} aria-label="Tiêu đề pillar" style={{ background: "transparent", border: 0, color: "inherit", width: "100%", padding: 0, marginTop: 6 }} />
          <div className="caption mono">pillar keyword: {meta.pillarKeyword}</div>
        </div>
        <div className="actions">
          <span className={[s.status, dirty ? s.dirty : ""].join(" ")} aria-live="polite">{saveMsg ?? (dirty ? "Chưa lưu thay đổi" : "Tất cả đã lưu")}</span>
          <Button variant="primary" iconLeft={<Save size={16} aria-hidden />} onClick={save} loading={pending} disabled={!dirty}>Lưu</Button>
        </div>
      </div>

      <div className={s.layout}>
        <div className="stack">
          <div className={s.canvas}>
            <div className={s.toolbar}>
              <Button size="s" variant="secondary" iconLeft={<Plus size={14} aria-hidden />} onClick={() => addNode("cluster", "pillar")}>Thêm cluster</Button>
              <Button size="s" variant="ghost" iconLeft={<Plus size={14} aria-hidden />} onClick={() => selected && addNode("supporting", selected.kind === "supporting" ? (selected.parentId ?? "pillar") : selected.id)} disabled={!selected || selected.kind === "pillar"}>Thêm supporting</Button>
              <span className={s.spacer} />
              <div className={s.legend}><span><i style={{ background: "var(--volt)" }} />Pillar</span><span><i style={{ background: "var(--fg-2)" }} />Cluster</span><span><i style={{ border: "1px dashed var(--fg-3)" }} />Supporting</span><span><Link2 size={12} aria-hidden /> kéo từ chấm dưới sang node khác để tạo link</span></div>
            </div>
            <div className={s.flow}>
              <ReactFlow<TopicNodeType, Edge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={(c) => { onNodesChange(c); if (c.some((x) => x.type === "position" && x.dragging === false)) markDirty(); }} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={onNodeClick} onPaneClick={() => setSelectedId(null)} fitView fitViewOptions={{ padding: 0.15, maxZoom: 1 }} colorMode="dark" minZoom={0.2} proOptions={{ hideAttribution: true }}>
                <Background gap={24} size={1} color="rgba(255,255,255,0.06)" /> {/* lint-allow-color: React Flow nhận chuỗi màu */}
                <Controls showInteractive={false} />
                <MiniMap pannable zoomable style={{ width: 140, height: 100 }} /* lint-allow-color */ nodeColor={(n) => ((n as TopicNodeType).data?.node?.kind === "pillar" ? "#FFEA00" : "#6E737A")} maskColor="rgba(3,3,4,0.6)" />
              </ReactFlow>
            </div>
          </div>

          <Panel title="Chiến lược">
            <textarea className="body-s" value={meta.strategy} onChange={(e) => { setMeta({ ...meta, strategy: e.target.value }); markDirty(); }} rows={3} aria-label="Chiến lược cluster" style={{ width: "100%", background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: "var(--radius-s)", color: "var(--fg-1)", padding: 10, resize: "vertical" }} />
          </Panel>

          <Panel title="Danh sách bài" sub={`${topicNodes.length} node · ${edges.length} link`} flush>
            <Table columns={["Bài", "Từ khoá", "Ý định", "Loại", "Ưu tiên", "Brief"]} minWidth={720} rows={[...topicNodes].sort((a, b) => (a.kind === "pillar" ? -1 : b.kind === "pillar" ? 1 : a.kind.localeCompare(b.kind))).map((n) => [
              <button key="t" onClick={() => setSelectedId(n.id)} style={{ background: "none", border: 0, color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer", textDecoration: selectedId === n.id ? "underline" : "none" }}>{n.title}</button>,
              <span key="k" className="mono">{n.targetKeyword}</span>,
              <Badge key="i" tone="outline">{n.intent}</Badge>,
              n.kind,
              <Badge key="p" tone={n.priority === "high" ? "new" : "outline"}>{n.priority}</Badge>,
              briefsByKeyword[n.targetKeyword.toLowerCase()] ? <Link key="b" href={`/projects/${projectId}/briefs/${briefsByKeyword[n.targetKeyword.toLowerCase()]}`} style={{ textDecoration: "underline" }}>Xem</Link> : <span key="b" className="muted">—</span>,
            ])} />
          </Panel>
        </div>

        <aside className={s.aside}>
          {selected ? (
            <Panel title={selected.kind === "pillar" ? "Pillar" : selected.kind === "cluster" ? "Cluster" : "Supporting"} sub={selected.id} action={selected.kind !== "pillar" ? <button className={s.iconBtn} onClick={() => removeNode(selected.id)} aria-label="Xoá node" title="Xoá node"><Trash2 size={14} /></button> : undefined}>
              <div className={s.field}><label htmlFor="n-title">Tiêu đề bài</label><input id="n-title" value={selected.title} onChange={(e) => updateNode(selected.id, { title: e.target.value })} style={inputStyle} /></div>
              <div className={s.field}><label htmlFor="n-kw">Từ khoá mục tiêu</label><input id="n-kw" value={selected.targetKeyword} onChange={(e) => updateNode(selected.id, { targetKeyword: e.target.value })} style={inputStyle} /></div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                <div className={s.field}><label htmlFor="n-intent">Ý định</label><select id="n-intent" value={selected.intent} onChange={(e) => updateNode(selected.id, { intent: e.target.value as ClusterNode["intent"] })} style={inputStyle}>{INTENTS.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
                <div className={s.field}><label htmlFor="n-prio">Ưu tiên</label><select id="n-prio" value={selected.priority} onChange={(e) => updateNode(selected.id, { priority: e.target.value as ClusterNode["priority"] })} style={inputStyle}>{PRIORITIES.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
              </div>
              <div className={s.field}><label htmlFor="n-format">Định dạng</label><input id="n-format" value={selected.format} onChange={(e) => updateNode(selected.id, { format: e.target.value })} style={inputStyle} /></div>
              <div className={s.field}><label htmlFor="n-sum">Tóm tắt</label><textarea id="n-sum" value={selected.summary} onChange={(e) => updateNode(selected.id, { summary: e.target.value })} rows={3} style={{ ...inputStyle, height: "auto", padding: 8, resize: "vertical" }} /></div>
              <div className={s.field}><label htmlFor="n-sec">Từ khoá phụ (phẩy)</label><input id="n-sec" value={selected.secondaryKeywords.join(", ")} onChange={(e) => updateNode(selected.id, { secondaryKeywords: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} style={inputStyle} /></div>

              <div>
                <div className="micro" style={{ marginBottom: 6 }}>Internal link · {selectedEdges.length}</div>
                <div className={s.links}>
                  {selectedEdges.length === 0 && <span className="caption">Kéo từ chấm dưới node sang node khác để tạo link.</span>}
                  {selectedEdges.map((e) => (
                    <div key={e.id} className={s.linkRow}>
                      <span className="caption" style={{ flex: "0 0 auto", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${titleOf(e.source)} → ${titleOf(e.target)}`}>{e.source === selected.id ? "→ " : "← "}{titleOf(e.source === selected.id ? e.target : e.source)}</span>
                      <input value={String(e.label ?? "")} onChange={(ev) => setEdgeAnchor(e.id, ev.target.value)} aria-label="Anchor text" placeholder="anchor text" />
                      <button className={s.iconBtn} onClick={() => removeEdge(e.id)} aria-label="Xoá link"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--line-1)", paddingTop: 12 }}>
                <div className="micro" style={{ marginBottom: 8 }}>Content Brief</div>
                {existingBrief ? (
                  <Link href={`/projects/${projectId}/briefs/${existingBrief}`}><Button size="s" variant="secondary" fullWidth>Xem brief đã tạo</Button></Link>
                ) : dirty ? (
                  <p className="caption">Lưu cluster trước khi tạo brief để brief dùng đúng bản đồ mới nhất.</p>
                ) : (
                  <BriefForm projectId={projectId} clusterId={clusterId} nodeId={selected.id} defaultKeyword={selected.targetKeyword} disabled={!canGenerate} compact />
                )}
              </div>
            </Panel>
          ) : (
            <Panel title="Chọn một node"><p className="caption">Bấm vào node trên sơ đồ để sửa tiêu đề, từ khoá, ý định, internal link hoặc tạo Content Brief cho bài đó.</p></Panel>
          )}

          <Panel title="Cannibalization" sub={`${meta.cannibalization.length + overlaps.length}`}>
            {meta.cannibalization.length + overlaps.length === 0 ? <p className="caption">Không có cảnh báo. Mỗi bài một ý định riêng.</p> : (
              <ul style={{ display: "grid", gap: 10 }}>
                {meta.cannibalization.map((w, i) => (
                  <li key={`m${i}`} className="body-s">
                    <div className="row" style={{ gap: 6 }}>{w.nodeIds.map((id) => <button key={id} onClick={() => setSelectedId(id)} style={{ background: "none", border: 0, padding: 0, color: "var(--fg-1)", font: "inherit", fontWeight: 500, cursor: "pointer", textDecoration: "underline", textAlign: "left" }}>{titleOf(id)}</button>)}</div>
                    <div className="caption">{w.reason}</div>
                    <div className="caption" style={{ color: "var(--success)" }}>Gợi ý: {w.fix}</div>
                  </li>
                ))}
                {overlaps.map((o) => <li key={o.a + o.b} className="body-s"><Badge tone="warning">{Math.round(o.similarity * 100)}%</Badge> <span style={{ fontWeight: 500 }}>{o.a}</span> ↔ <span style={{ fontWeight: 500 }}>{o.b}</span><div className="caption">Cùng ý định, trùng từ khoá — rule engine</div></li>)}
              </ul>
            )}
          </Panel>

          {!canGenerate && <SystemNotice tone="amber">Chưa có ANTHROPIC_API_KEY — vẫn chỉnh sửa và lưu được, nhưng không tạo brief.</SystemNotice>}
        </aside>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", height: 36, padding: "0 10px", background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: "var(--radius-s)", color: "var(--fg-1)", font: "var(--text-body-s)" };
