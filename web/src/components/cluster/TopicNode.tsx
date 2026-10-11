"use client";

import { Handle, Position, useConnection, useUpdateNodeInternals, type Node, type NodeProps } from "@xyflow/react";
import { memo, useEffect, type CSSProperties } from "react";
import { Badge } from "@/components/ui";
import type { ClusterNode } from "@/lib/schemas";
import type { LayoutDir } from "./layout";
import s from "./ClusterEditor.module.css";

/** `i`: thứ tự lúc vẽ lần đầu → độ trễ hiệu ứng xuất hiện. `dir`: hướng sơ đồ quyết định vị trí điểm nối. `kids`: số node con. */
export type TopicNodeType = Node<{ node: ClusterNode; hasBrief: boolean; i?: number; dir: LayoutDir; kids?: number }, "topic">;

const KIND_LABEL: Record<ClusterNode["kind"], string> = { pillar: "Pillar", cluster: "Cluster", supporting: "Supporting" };
const INTENT_TONE = { informational: "info", commercial: "warning", transactional: "success", navigational: "neutral", mixed: "outline" } as const;

function TopicNodeView({ id, data, selected }: NodeProps<TopicNodeType>) {
  const n = data.node;
  const connecting = useConnection((c) => c.inProgress && c.fromNode?.id !== id);
  // Đổi hướng sơ đồ → điểm nối đổi cạnh; React Flow cần đo lại vị trí handle, nếu không cạnh vẫn bám vị trí cũ
  const updateInternals = useUpdateNodeInternals();
  useEffect(() => { updateInternals(id); }, [data.dir, id, updateInternals]);
  const style = data.i != null ? ({ "--i": Math.min(data.i, 12) } as CSSProperties) : undefined;
  const inPos = data.dir === "TB" ? Position.Top : Position.Left;
  const outPos = data.dir === "TB" ? Position.Bottom : Position.Right;
  return (
    <div className={[s.node, s[n.kind] ?? "", selected ? s.nodeSelected : "", connecting ? s.nodeDrop : ""].join(" ")} style={style} title={n.summary ? `${n.title}\n\n${n.summary}` : n.title}>
      <Handle type="target" id="in" position={inPos} className={[s.handle, s.handleIn].join(" ")} />
      <div className={s.kind}>
        <span className={s.kindLabel}><i className={s.kindDot} aria-hidden />{KIND_LABEL[n.kind]}{data.kids ? <span className={s.kids}> · {data.kids}</span> : null}</span>
        {data.hasBrief && <span className={s.dot} title="Đã có brief" />}
      </div>
      <div className={s.title}>{n.title}</div>
      <div className={s.kw}>{n.targetKeyword}</div>
      <div className={s.meta}>
        <Badge tone={INTENT_TONE[n.intent]}>{n.intent}</Badge>
        <Badge tone={n.priority === "high" ? "new" : "outline"}>{n.priority}</Badge>
      </div>
      <Handle type="source" id="out" position={outPos} className={[s.handle, s.handleOut].join(" ")} title="Kéo để tạo internal link" />
    </div>
  );
}

export const TopicNode = memo(TopicNodeView);
