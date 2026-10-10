"use client";

import { useActionState } from "react";
import { Button, Input, Select, SystemNotice, Textarea } from "@/components/ui";
import { createProject, type ActionState } from "./actions";

export function CreateProjectForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createProject, undefined);
  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      <Input name="name" label="Tên dự án" placeholder="VD: Điện Thoại Giá Kho" required minLength={2} />
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <Input name="domain" label="Domain" placeholder="giakho.vn" />
        <Input name="industry" label="Ngành" placeholder="Bán lẻ điện thoại" />
        <Select name="locale" label="Thị trường" defaultValue="vi-VN">
          <option value="vi-VN">Tiếng Việt (VN)</option>
          <option value="en-US">English (US)</option>
          <option value="en-GB">English (UK)</option>
          <option value="en-AU">English (AU)</option>
        </Select>
      </div>
      <Textarea name="brandVoice" label="Giọng văn thương hiệu" placeholder="Thân thiện, chuyên gia, đi thẳng vào vấn đề; xưng 'Giá Kho' – 'bạn'..." rows={3} />
      <details>
        <summary className="caption" style={{ cursor: "pointer" }}>Thực thể & Knowledge Graph (tuỳ chọn)</summary>
        <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
          <Input name="organization" label="Tên tổ chức" placeholder="Công ty ..." />
          <Input name="products" label="Sản phẩm/dịch vụ" placeholder="iPhone, Samsung, trả góp 0%" hint="Ngăn cách bằng dấu phẩy" />
          <Input name="authors" label="Tác giả/chuyên gia" placeholder="Nguyễn Văn A – Trưởng phòng kỹ thuật" hint="Ngăn cách bằng dấu phẩy" />
          <Input name="sameAs" label="Liên kết sameAs" placeholder="https://facebook.com/..., https://youtube.com/..." hint="Ngăn cách bằng dấu phẩy" />
        </div>
      </details>
      {state?.error && <SystemNotice tone="red">{state.error}</SystemNotice>}
      <div><Button type="submit" variant="primary" loading={pending}>Tạo dự án</Button></div>
    </form>
  );
}
