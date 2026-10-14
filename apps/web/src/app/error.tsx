"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button, EmptyState, Panel } from "@/components/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.warn("[route error]", error.digest ?? "", error.message); }, [error]);
  return (
    <div className="container stack">
      <Panel className="page-in">
        <EmptyState
          icon={<TriangleAlert size={22} />}
          title="Có lỗi khi tải trang"
          text={<>Thử tải lại — nếu vẫn lỗi, quay về danh sách dự án.{error.digest && <><br /><span className="mono muted">Mã lỗi: {error.digest}</span></>}</>}
          action={
            <>
              <Button variant="primary" iconLeft={<RotateCcw size={16} aria-hidden />} onClick={() => reset()}>Thử lại</Button>
              <Link href="/" className="btn-link">Về danh sách dự án</Link>
            </>
          }
        />
      </Panel>
    </div>
  );
}
