import { Compass } from "lucide-react";
import Link from "next/link";
import { EmptyState, Panel } from "@/components/ui";

export const metadata = { title: "Không tìm thấy" };

export default function NotFound() {
  return (
    <div className="container stack">
      <Panel className="page-in">
        <EmptyState
          icon={<Compass size={22} />}
          title="Không tìm thấy trang"
          text="Liên kết có thể đã cũ, hoặc dự án / bài viết đã bị xoá."
          action={
            <>
              <Link href="/" className="btn-link primary">Về danh sách dự án</Link>
              <Link href="/usage" className="btn-link">Xem chi phí AI</Link>
            </>
          }
        />
      </Panel>
    </div>
  );
}
