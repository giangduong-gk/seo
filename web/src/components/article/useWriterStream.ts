"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WriterEvent, WriterMode } from "@/lib/schemas";

export type WriterHandlers = {
  /** Gọi mỗi khi có thêm text; `text` là toàn bộ nội dung đã nhận tới lúc này. */
  onDelta?: (mode: WriterMode, text: string) => void;
  /** Server đã lưu body + JSON-LD và đặt status "review". */
  onDone?: (mode: WriterMode, text: string, words: number) => void;
  onError?: (mode: WriterMode, message: string) => void;
  /** Người dùng bấm huỷ — `text` là phần đã nhận (server chưa lưu). */
  onAbort?: (mode: WriterMode, text: string) => void;
};

async function errorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; message?: string };
    return j.error ?? j.message ?? `HTTP ${res.status}`;
  } catch { return `HTTP ${res.status}`; }
}

/** Đọc SSE từ POST /api/articles/[id]/write — mỗi event `data: <WriterEvent>\n\n`. */
export function useWriterStream(articleId: string, handlers: WriterHandlers = {}) {
  const h = useRef(handlers);
  useEffect(() => { h.current = handlers; });
  const abortRef = useRef<AbortController | null>(null);
  const [mode, setMode] = useState<WriterMode | null>(null);
  const [incoming, setIncoming] = useState("");
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (m: WriterMode, instruction?: string) => {
    if (abortRef.current) return; // đang chạy
    const ac = new AbortController();
    abortRef.current = ac;
    setMode(m); setIncoming(""); setError(null);
    let buf = ""; let text = ""; let finished = false;
    try {
      const res = await fetch(`/api/articles/${articleId}/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(instruction ? { mode: m, instruction } : { mode: m }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(await errorMessage(res));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            let ev: WriterEvent;
            try { ev = JSON.parse(line.slice(6)) as WriterEvent; } catch { continue; }
            if (ev.type === "delta") { text += ev.text; setIncoming(text); h.current.onDelta?.(m, text); }
            else if (ev.type === "done") { finished = true; h.current.onDone?.(m, text, ev.words); }
            else if (ev.type === "error") throw new Error(ev.message || "Writer báo lỗi");
          }
        }
      }
      if (!finished) throw new Error("Kết nối bị ngắt trước khi Claude viết xong.");
    } catch (e) {
      if (ac.signal.aborted) { h.current.onAbort?.(m, text); }
      else { const msg = e instanceof Error ? e.message : String(e); setError(msg); h.current.onError?.(m, msg); }
    } finally {
      abortRef.current = null;
      setMode(null);
    }
  }, [articleId]);

  const cancel = useCallback(() => { abortRef.current?.abort(); }, []);
  useEffect(() => () => abortRef.current?.abort(), []);

  return { start, cancel, streaming: mode !== null, mode, incoming, error };
}
