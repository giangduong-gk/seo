"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";

export function CopyButton({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  async function copy() {
    try {
      const md = await fetch(url).then((r) => r.text());
      await navigator.clipboard.writeText(md);
      setState("copied");
    } catch { setState("error"); }
    setTimeout(() => setState("idle"), 1800);
  }
  return (
    <Button variant="secondary" onClick={copy} iconLeft={state === "copied" ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} style={{ minWidth: 150 }} aria-live="polite">
      {state === "copied" ? "Đã copy" : state === "error" ? "Không copy được" : "Copy Markdown"}
    </Button>
  );
}
