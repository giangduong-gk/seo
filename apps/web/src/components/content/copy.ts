"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui";

/** Copy vào clipboard + toast. Trả về true nếu thành công. */
export function useCopy() {
  const { toast } = useToast();
  return useCallback(async (text: string, title: string, description?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title, description, tone: "success", id: "copy" });
      return true;
    } catch {
      toast({ title: "Không copy được", description: "Trình duyệt chặn quyền clipboard — hãy chọn và copy thủ công.", tone: "error", id: "copy" });
      return false;
    }
  }, [toast]);
}
