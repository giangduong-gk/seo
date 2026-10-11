import { Fragment, type ReactNode } from "react";
import s from "./content.module.css";

/** **đậm** → <strong>; phần còn lại giữ nguyên văn bản (không render HTML). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

/**
 * Văn bản model trả về (có xuống dòng, gạch đầu dòng "- ", **đậm**) → đoạn văn + danh sách, cột đọc ≤ --measure.
 * An toàn: chỉ tạo phần tử React, không dangerouslySetInnerHTML.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let para: string[] = [];
  const flushPara = () => { if (para.length) { blocks.push(<p key={blocks.length}>{inline(para.join(" "))}</p>); para = []; } };
  const flushList = () => { if (bullets.length) { blocks.push(<ul key={blocks.length}>{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>); bullets = []; } };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    const m = /^(?:[-•*]|\d+[.)])\s+(.*)$/.exec(line);
    if (m) { flushPara(); bullets.push(m[1]); } else { flushList(); para.push(line); }
  }
  flushPara(); flushList();
  return <div className={[s.prose, className ?? ""].join(" ")}>{blocks}</div>;
}
