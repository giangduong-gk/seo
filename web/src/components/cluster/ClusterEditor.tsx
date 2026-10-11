"use client";

import "@xyflow/react/dist/style.css";
import { Background, MiniMap, Panel as FlowPanel, ReactFlow, ReactFlowProvider, addEdge, useEdgesState, useNodesState, useReactFlow, type Connection, type Edge, type NodeMouseHandler, type OnConnect } from "@xyflow/react";
import { ArrowDown, Crosshair, Link2, Maximize2, Minus, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveClusterMap } from "@/app/actions";
import { BriefForm } from "@/app/projects/[id]/briefs/BriefForm";
import { isTypingTarget, prefersReducedMotion, useAutoGrow, useReducedMotion, useWide } from "@/components/article/hooks";
import { Badge, Button, Panel, SystemNotice, Table, useToast } from "@/components/ui";
import { detectKeywordOverlap } from "@/lib/overlap";
import type { ClusterNode, StoredClusterMap } from "@/lib/schemas";
import s from "./ClusterEditor.module.css";
import { TopicNode, type TopicNodeType } from "./TopicNode";

const nodeTypes = { topic: TopicNode };
const INTENTS = ["informational", "commercial", "transactional", "navigational", "mixed"] as const;
const PRIORITIES = ["high", "medium", "low"] as const;
const KIND_TEXT: Record<ClusterNode["kind"], string> = { pillar: "Pillar", cluster: "Cluster", supporting: "Supporting" };
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

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

const KIND_ORDER = { pillar: 0, cluster: 1, supporting: 2 } as const;
function toFlowNodes(map: StoredClusterMap, briefs: Record<string, string>): TopicNodeType[] {
  const layout = tieredLayout(map.nodes);
  // thứ tự xuất hiện: pillar → cluster → supporting
  const order = [...map.nodes].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]).map((n) => n.id);
  return map.nodes.map((n) => ({
    id: n.id,
    type: "topic",
    position: map.positions?.[n.id] ?? layout[n.id],
    data: { node: n, hasBrief: Boolean(briefs[n.targetKeyword.toLowerCase()]), i: order.indexOf(n.id) },
  }));
}

function toFlowEdges(map: StoredClusterMap): Edge[] {
  return map.links.map((l) => ({ id: `${l.fromId}->${l.toId}`, source: l.fromId, target: l.toId, label: l.anchor, data: { why: l.why } }));
}

type Props = { projectId: string; clusterId: string; initial: StoredClusterMap; model: string; canGenerate: boolean; briefsByKeyword: Record<string, string> };

export function ClusterEditor(props: Props) {
  return <ReactFlowProvider><Editor {...props} /></ReactFlowProvider>;
}

function Editor({ projectId, clusterId, initial, model, canGenerate, briefsByKeyword }: Props) {
  const { toast } = useToast();
  const rf = useReactFlow<TopicNodeType, Edge>();
  const wide = useWide();
  const [meta, setMeta] = useState({ pillarTitle: initial.pillarTitle, pillarKeyword: initial.pillarKeyword, strategy: initial.strategy, cannibalization: initial.cannibalization });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const init = useMemo(() => ({ nodes: toFlowNodes(initial, briefsByKeyword), edges: toFlowEdges(initial) }), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<TopicNodeType>(init.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(init.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [pending, startTransition] = useTransition();
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const strategyRef = useRef<HTMLTextAreaElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  useAutoGrow(titleRef, meta.pillarTitle);
  useAutoGrow(strategyRef, meta.strategy);

  const topicNodes = useMemo(() => nodes.map((n) => n.data.node), [nodes]);
  const selected = nodes.find((n) => n.id === selectedId)?.data.node ?? null;
  const overlaps = useMemo(() => detectKeywordOverlap(topicNodes.map((n) => ({ term: n.targetKeyword, intent: n.intent }))), [topicNodes]);
  const dur = (ms: number) => (prefersReducedMotion() ? 0 : ms);

  const markDirty = () => setDirty(true);

  /* ───── Viewport ───── */
  const fit = useCallback(() => { void rf.fitView({ padding: 0.15, maxZoom: 1, duration: dur(420) }); }, [rf]); // eslint-disable-line react-hooks/exhaustive-deps
  // Khung canvas đổi kích thước sau khi hydrate (--subnav-h, xoay máy, kéo cửa sổ) → căn lại cho vừa,
  // trừ khi người dùng đã tự kéo/zoom (onMoveStart có event chỉ khi do người dùng).
  const flowWrap = useRef<HTMLDivElement>(null);
  const userMoved = useRef(false);
  useEffect(() => {
    const el = flowWrap.current; if (!el || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (!userMoved.current) void rf.fitView({ padding: 0.15, maxZoom: 1 }); }); });
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [rf]);
  const focusNode = useCallback((id: string | null) => {
    if (!id) return;
    const n = rf.getNode(id);
    if (!n) return;
    const w = n.measured?.width ?? NODE_W, h = n.measured?.height ?? 110;
    void rf.setCenter(n.position.x + w / 2, n.position.y + h / 2, { zoom: Math.max(rf.getZoom(), 0.9), duration: dur(480) });
  }, [rf]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Chọn từ danh sách / cảnh báo: desktop → đưa node vào giữa sơ đồ; điện thoại → cuộn tới khung sửa. */
  const pickFromList = (id: string) => {
    setSelectedId(id);
    if (wide) requestAnimationFrame(() => focusNode(id));
    else requestAnimationFrame(() => asideRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" }));
  };

  // Đồng bộ trạng thái "selected" của React Flow với node đang sửa (chọn từ bảng cũng sáng viền)
  useEffect(() => {
    setNodes((ns) => (ns.some((n) => Boolean(n.selected) !== (n.id === selectedId)) ? ns.map((n) => (Boolean(n.selected) === (n.id === selectedId) ? n : { ...n, selected: n.id === selectedId })) : ns));
  }, [selectedId, setNodes]);

  /* ───── Sửa sơ đồ ───── */
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
    setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), { id, type: "topic", position: { x: p.x + (kind === "cluster" ? 280 : 0), y: p.y + (kind === "cluster" ? 0 : 210) }, data: { node, hasBrief: false }, selected: true }]);
    setEdges((es) => [...es, { id: `${parentId}->${id}`, source: parentId, target: id, label: node.title, data: { why: null } }]);
    setSelectedId(id);
    markDirty();
    requestAnimationFrame(() => requestAnimationFrame(() => focusNode(id)));
  };

  const removeNode = (id: string) => {
    const target = nodes.find((n) => n.id === id)?.data.node;
    if (!target || target.kind === "pillar") return;
    const kids = nodes.filter((n) => n.data.node.parentId === id).length;
    if (!window.confirm(`Xoá node “${target.title}”?${kids ? ` ${kids} node con sẽ nối lên node cha.` : ""} Các internal link của node cũng bị xoá.`)) return;
    setNodes((ns) => ns.filter((n) => n.id !== id).map((n) => (n.data.node.parentId === id ? { ...n, data: { ...n.data, node: { ...n.data.node, parentId: target.parentId } } } : n)));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    setSelectedId(null);
    markDirty();
    toast({ tone: "info", title: "Đã xoá node", description: `${target.title} — nhớ bấm Lưu để giữ thay đổi.` });
  };

  const onConnect: OnConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    const target = nodes.find((n) => n.id === c.target)?.data.node;
    setEdges((es) => addEdge({ ...c, id: `${c.source}->${c.target}`, label: target?.title ?? "", data: { why: null } }, es));
    markDirty();
  }, [nodes, setEdges]);

  const onNodeClick: NodeMouseHandler<TopicNodeType> = useCallback((_, n) => setSelectedId(n.id), []);
  const onNodeEnter: NodeMouseHandler<TopicNodeType> = useCallback((_, n) => setHoverId(n.id), []);
  const onNodeLeave: NodeMouseHandler<TopicNodeType> = useCallback(() => setHoverId(null), []);

  const setEdgeAnchor = (id: string, anchor: string) => { setEdges((es) => es.map((e) => (e.id === id ? { ...e, label: anchor } : e))); markDirty(); };
  const removeEdge = (id: string) => { setEdges((es) => es.filter((e) => e.id !== id)); markDirty(); };

  const save = useCallback(() => {
    if (!dirty || pending) return;
    const data: StoredClusterMap = {
      ...meta,
      nodes: topicNodes,
      links: edges.map((e) => ({ fromId: e.source, toId: e.target, anchor: String(e.label ?? ""), why: (e.data as { why?: string | null } | undefined)?.why ?? null })),
      positions: Object.fromEntries(nodes.map((n) => [n.id, n.position])),
    };
    startTransition(async () => {
      const r = await saveClusterMap(clusterId, data);
      if (r.ok) { setDirty(false); setSavedAt(new Date()); toast({ id: `cluster-save-${clusterId}`, tone: "success", title: "Đã lưu cluster", description: `${topicNodes.length} node · ${edges.length} link` }); }
      else toast({ id: `cluster-save-${clusterId}`, tone: "error", title: "Không lưu được cluster", description: r.error });
    });
  }, [dirty, pending, meta, topicNodes, edges, nodes, clusterId, toast]);

  /* ───── Phím tắt + chặn rời trang khi chưa lưu ───── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); save(); return; }
      if (isTypingTarget(e.target) || mod || e.altKey) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selected && selected.kind !== "pillar") { e.preventDefault(); removeNode(selected.id); }
      else if (e.key === "Escape" && selectedId) setSelectedId(null);
      else if (e.key === "f" || e.key === "F") { e.preventDefault(); fit(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  /* ───── Làm nổi cạnh của node đang chọn / đang hover ───── */
  const reduced = useReducedMotion();
  const viewEdges = useMemo(() => edges.map((e) => {
    const on = selectedId != null && (e.source === selectedId || e.target === selectedId);
    const hover = hoverId != null && (e.source === hoverId || e.target === hoverId);
    const cls = [on ? "ce-hl" : selectedId ? "ce-dim" : "", hover ? "ce-hover" : ""].join(" ").trim();
    return cls || on ? { ...e, className: cls, animated: on && !reduced, zIndex: on ? 2 : hover ? 1 : 0 } : e;
  }), [edges, selectedId, hoverId, reduced]);
  const viewNodes = useMemo(() => {
    if (!selectedId) return nodes;
    const near = new Set([selectedId]);
    edges.forEach((e) => { if (e.source === selectedId) near.add(e.target); if (e.target === selectedId) near.add(e.source); });
    return nodes.map((n) => (near.has(n.id) ? n : { ...n, className: "ce-dim" }));
  }, [nodes, edges, selectedId]);

  const titleOf = (id: string) => nodes.find((n) => n.id === id)?.data.node.title ?? id;
  const selectedEdges = selected ? edges.filter((e) => e.source === selected.id || e.target === selected.id) : [];
  const existingBrief = selected ? briefsByKeyword[selected.targetKeyword.toLowerCase()] : undefined;
  const mod = IS_MAC ? "⌘" : "Ctrl";
  const statusText = pending ? "Đang lưu…" : dirty ? "Chưa lưu thay đổi" : savedAt ? `Đã lưu ${savedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Tất cả đã lưu";
  const warnCount = meta.cannibalization.length + overlaps.length;

  return (
    <div className="stack">
      <div className={s.head}>
        <div className={s.headText}>
          <div className="micro">Topic Cluster · {model}</div>
          <textarea
            ref={titleRef} rows={1} className={["h2", s.titleInput].join(" ")} value={meta.pillarTitle} aria-label="Tiêu đề pillar" spellCheck={false}
            onChange={(e) => { setMeta({ ...meta, pillarTitle: e.target.value.replace(/\s*\n+\s*/g, " ") }); markDirty(); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
          />
          <div className="caption mono">pillar keyword: {meta.pillarKeyword}</div>
        </div>
        <div className={s.headActions}>
          <span className={[s.status, dirty ? s.dirty : ""].join(" ")} role="status"><span className={s.statusDot} aria-hidden />{statusText}</span>
          <Button variant={dirty ? "primary" : "secondary"} iconLeft={<Save size={16} aria-hidden />} onClick={save} loading={pending} disabled={!dirty} title={`${mod} + S`}>Lưu</Button>
        </div>
      </div>

      <div className={s.layout}>
        <div className={s.canvas}>
          <div className={s.toolbar} role="toolbar" aria-label="Công cụ sơ đồ">
            <Button size="s" variant="secondary" className={s.tap} iconLeft={<Plus size={14} aria-hidden />} onClick={() => addNode("cluster", "pillar")}>Thêm cluster</Button>
            <Button size="s" variant="ghost" className={s.tap} iconLeft={<Plus size={14} aria-hidden />} onClick={() => selected && addNode("supporting", selected.kind === "supporting" ? (selected.parentId ?? "pillar") : selected.id)} disabled={!selected || selected.kind === "pillar"} title={!selected || selected.kind === "pillar" ? "Chọn một node cluster trước" : undefined}>Thêm supporting</Button>
            <span className={s.spacer} />
            <div className={s.viewTools}>
              <button type="button" className={s.toolBtn} onClick={() => void rf.zoomOut({ duration: dur(200) })} aria-label="Thu nhỏ" title="Thu nhỏ"><Minus size={15} /></button>
              <button type="button" className={s.toolBtn} onClick={() => void rf.zoomIn({ duration: dur(200) })} aria-label="Phóng to" title="Phóng to"><Plus size={15} /></button>
              <span className={s.toolSep} aria-hidden />
              <button type="button" className={[s.toolBtn, s.toolLabel].join(" ")} onClick={fit} title="Vừa khung (F)"><Maximize2 size={14} aria-hidden /><span>Vừa khung</span></button>
              <button type="button" className={[s.toolBtn, s.toolLabel].join(" ")} onClick={() => focusNode(selectedId)} disabled={!selectedId} title="Tới node đang chọn"><Crosshair size={14} aria-hidden /><span>Tới node</span></button>
            </div>
          </div>
          <div className={s.flow} ref={flowWrap}>
            <ReactFlow<TopicNodeType, Edge>
              onMoveStart={(e) => { if (e) userMoved.current = true; }}
              nodes={viewNodes} edges={viewEdges} nodeTypes={nodeTypes}
              onNodesChange={(c) => { onNodesChange(c); if (c.some((x) => x.type === "position" && x.dragging === false)) markDirty(); }}
              onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={onNodeClick} onNodeMouseEnter={onNodeEnter} onNodeMouseLeave={onNodeLeave}
              onPaneClick={() => setSelectedId(null)} deleteKeyCode={null} fitView fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
              colorMode="dark" minZoom={0.2} maxZoom={1.8} proOptions={{ hideAttribution: true }}
            >
              <Background gap={24} size={1} color="rgba(255,255,255,0.06)" /> {/* lint-allow-color: React Flow nhận chuỗi màu */}
              <MiniMap className={s.minimap} pannable zoomable style={{ width: 140, height: 100 }} /* lint-allow-color */ nodeColor={(n) => ((n as TopicNodeType).data?.node?.kind === "pillar" ? "#FFEA00" : "#82878E")} maskColor="rgba(3,3,4,0.6)" />
              <FlowPanel position="bottom-left" className={s.legend}>
                <span><i className={s.lgPillar} />Pillar</span><span><i className={s.lgCluster} />Cluster</span><span><i className={s.lgSupport} />Supporting</span>
                <span className={s.legendHint}><Link2 size={12} aria-hidden /> kéo từ chấm dưới sang node khác để tạo link · <kbd>F</kbd> vừa khung · <kbd>Del</kbd> xoá · <kbd>Esc</kbd> bỏ chọn</span>
              </FlowPanel>
            </ReactFlow>
            {selected && !wide && (
              <button type="button" className={s.editPill} onClick={() => asideRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" })}>
                <span className={s.editPillText}>Sửa: {selected.title}</span><ArrowDown size={14} aria-hidden />
              </button>
            )}
          </div>
        </div>

        <aside ref={asideRef} className={s.aside} aria-label="Chi tiết node">
          {selected ? (
            <Panel title={KIND_TEXT[selected.kind]} sub={selected.id} action={selected.kind !== "pillar" ? <button type="button" className={s.iconBtn} onClick={() => removeNode(selected.id)} aria-label="Xoá node" title="Xoá node (Del)"><Trash2 size={14} /></button> : undefined}>
              <div key={selected.id} className={s.fadeIn}>
                <div className={s.form}>
                  <div className={s.field}><label htmlFor="n-title">Tiêu đề bài</label><AutoTextarea id="n-title" value={selected.title} onChange={(v) => updateNode(selected.id, { title: v.replace(/\s*\n+\s*/g, " ") })} singleLine /></div>
                  <div className={s.field}><label htmlFor="n-kw">Từ khoá mục tiêu</label><input id="n-kw" className={s.input} value={selected.targetKeyword} onChange={(e) => updateNode(selected.id, { targetKeyword: e.target.value })} /></div>
                  <div className={s.two}>
                    <div className={s.field}><label htmlFor="n-intent">Ý định</label><select id="n-intent" className={s.input} value={selected.intent} onChange={(e) => updateNode(selected.id, { intent: e.target.value as ClusterNode["intent"] })}>{INTENTS.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
                    <div className={s.field}><label htmlFor="n-prio">Ưu tiên</label><select id="n-prio" className={s.input} value={selected.priority} onChange={(e) => updateNode(selected.id, { priority: e.target.value as ClusterNode["priority"] })}>{PRIORITIES.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
                  </div>
                  <div className={s.field}><label htmlFor="n-format">Định dạng</label><input id="n-format" className={s.input} value={selected.format} onChange={(e) => updateNode(selected.id, { format: e.target.value })} /></div>
                  <div className={s.field}><label htmlFor="n-sum">Tóm tắt</label><AutoTextarea id="n-sum" value={selected.summary} onChange={(v) => updateNode(selected.id, { summary: v })} /></div>
                  <div className={s.field}><label htmlFor="n-sec">Từ khoá phụ (phẩy)</label><input id="n-sec" className={s.input} value={selected.secondaryKeywords.join(", ")} onChange={(e) => updateNode(selected.id, { secondaryKeywords: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></div>

                  <div>
                    <div className="micro" style={{ marginBottom: 8 }}>Internal link · {selectedEdges.length}</div>
                    <div className={s.links}>
                      {selectedEdges.length === 0 && <span className="caption">Kéo từ chấm dưới node sang node khác để tạo link.</span>}
                      {selectedEdges.map((e) => (
                        <div key={e.id} className={s.linkRow}>
                          <button type="button" className={s.linkTo} title={`${titleOf(e.source)} → ${titleOf(e.target)}`} onClick={() => { const other = e.source === selected.id ? e.target : e.source; setSelectedId(other); focusNode(other); }}>
                            {e.source === selected.id ? "→ " : "← "}{titleOf(e.source === selected.id ? e.target : e.source)}
                          </button>
                          <input value={String(e.label ?? "")} onChange={(ev) => setEdgeAnchor(e.id, ev.target.value)} aria-label="Anchor text" placeholder="anchor text" />
                          <button type="button" className={s.iconBtn} onClick={() => removeEdge(e.id)} aria-label="Xoá link" title="Xoá link"><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={s.briefBox}>
                    <div className="micro" style={{ marginBottom: 8 }}>Content Brief</div>
                    {existingBrief ? (
                      <Link href={`/projects/${projectId}/briefs/${existingBrief}`}><Button size="s" variant="secondary" className={s.tap} fullWidth>Xem brief đã tạo</Button></Link>
                    ) : dirty ? (
                      <p className="caption">Lưu cluster trước khi tạo brief để brief dùng đúng bản đồ mới nhất.</p>
                    ) : (
                      <BriefForm projectId={projectId} clusterId={clusterId} nodeId={selected.id} defaultKeyword={selected.targetKeyword} disabled={!canGenerate} compact />
                    )}
                  </div>
                </div>
              </div>
            </Panel>
          ) : (
            <Panel title="Chọn một node"><p className="caption">Bấm vào node trên sơ đồ để sửa tiêu đề, từ khoá, ý định, internal link hoặc tạo Content Brief cho bài đó.</p></Panel>
          )}

          <Panel title="Cannibalization" sub={`${warnCount}`}>
            {warnCount === 0 ? <p className="caption">Không có cảnh báo. Mỗi bài một ý định riêng.</p> : (
              <ul className={s.warnList}>
                {meta.cannibalization.map((w, i) => (
                  <li key={`m${i}`} className="body-s">
                    <div className={s.warnNodes}>{w.nodeIds.map((id) => <button type="button" key={id} className={s.nodeLink} onClick={() => pickFromList(id)}>{titleOf(id)}</button>)}</div>
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

        <div className={s.rest}>
          <Panel title="Chiến lược">
            <textarea ref={strategyRef} className={s.strategy} value={meta.strategy} onChange={(e) => { setMeta({ ...meta, strategy: e.target.value }); markDirty(); }} rows={3} aria-label="Chiến lược cluster" />
          </Panel>

          <Panel title="Danh sách bài" sub={`${topicNodes.length} node · ${edges.length} link`} flush>
            <Table columns={["Bài", "Từ khoá", "Ý định", "Loại", "Ưu tiên", "Brief"]} minWidth={720} rows={[...topicNodes].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]).map((n) => [
              <button type="button" key="t" className={[s.nodeLink, s.tableTitle, selectedId === n.id ? s.nodeLinkOn : ""].join(" ")} onClick={() => pickFromList(n.id)} title={n.title}>{n.title}</button>,
              <span key="k" className="mono">{n.targetKeyword}</span>,
              <Badge key="i" tone="outline">{n.intent}</Badge>,
              n.kind,
              <Badge key="p" tone={n.priority === "high" ? "new" : "outline"}>{n.priority}</Badge>,
              briefsByKeyword[n.targetKeyword.toLowerCase()] ? <Link key="b" href={`/projects/${projectId}/briefs/${briefsByKeyword[n.targetKeyword.toLowerCase()]}`} style={{ textDecoration: "underline" }}>Xem</Link> : <span key="b" className="muted">—</span>,
            ])} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** Textarea tự cao theo nội dung — tiêu đề dài trong node luôn hiện đầy đủ ở khung sửa. */
function AutoTextarea({ id, value, onChange, singleLine }: { id: string; value: string; onChange: (v: string) => void; singleLine?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(ref, value);
  return (
    <textarea
      ref={ref} id={id} rows={1} className={[s.input, s.autoArea].join(" ")} value={value} onChange={(e) => onChange(e.target.value)}
      onKeyDown={singleLine ? (e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } } : undefined}
    />
  );
}
