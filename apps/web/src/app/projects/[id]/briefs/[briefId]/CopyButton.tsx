"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, useToast } from "@/components/ui";

/** Copy toàn bộ brief dạng Markdown (lấy từ API) + toast. Bề rộng cố định → đổi nhãn không nhảy layout. */
export function CopyButton({ url }: { url: string }) {
  const { toast } = useToast();
  const [state, setState] = useState<"idle" | "busy" | "copied">("idle");
  useEffect(() => { if (state !== "copied") return; const t = setTimeout(() => setState("idle"), 1800); return () => clearTimeout(t); }, [state]);
  async function copy() {
    setState("busy");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const md = await res.text();
      await navigator.clipboard.writeText(md);
      setState("copied");
      toast({ title: "Đã copy Markdown", description: `${md.length.toLocaleString("vi-VN")} ký tự — dán vào Google Docs, Notion hoặc CMS.`, tone: "success", id: "copy" });
    } catch {
      setState("idle");
      toast({ title: "Không copy được Markdown", description: "Thử “Tải Markdown” thay thế.", tone: "error", id: "copy" });
    }
  }
  return (
    <Button variant="secondary" size="s" onClick={copy} loading={state === "busy"} iconLeft={state === "copied" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} style={{ minWidth: 142 }} aria-live="polite">
      {state === "copied" ? "Đã copy" : "Copy Markdown"}
    </Button>
  );
}
