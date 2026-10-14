"use client";

import { useActionState } from "react";
import { Button, Input, Select, SystemNotice, Textarea } from "@/components/ui";
import { createProject, type ActionState } from "@/app/actions";

export function CreateProjectForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createProject, undefined);
  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      <Input name="name" label="Tên dự án" placeholder="VD: Điện Thoại Giá Kho" required minLength={2} autoComplete="off" />
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))" }}>
        <Input name="domain" label="Domain" placeholder="giakho.vn" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} />
        <Input name="industry" label="Ngành" placeholder="Bán lẻ điện thoại" />
      </div>
      <Select name="locale" label="Thị trường" defaultValue="vi-VN">
        <option value="vi-VN">Tiếng Việt (VN)</option>
        <option value="en-US">English (US)</option>
        <option value="en-GB">English (UK)</option>
        <option value="en-AU">English (AU)</option>
      </Select>
      <Textarea name="brandVoice" label="Giọng văn thương hiệu" placeholder="Thân thiện, chuyên gia, đi thẳng vào vấn đề; xưng 'Giá Kho' – 'bạn'..." rows={2} autoGrow maxHeight={240} style={{ minHeight: 72 }} />
      <details>
        <summary className="caption disclosure" style={{ minHeight: 32 }}>Thực thể & Knowledge Graph (tuỳ chọn)</summary>
        <div style={{ display: "grid", gap: 14, paddingTop: 12 }}>
          <Input name="organization" label="Tên tổ chức" placeholder="Công ty ..." />
          <Input name="products" label="Sản phẩm/dịch vụ" placeholder="iPhone, Samsung, trả góp 0%" hint="Ngăn cách bằng dấu phẩy" />
          <Input name="authors" label="Tác giả/chuyên gia" placeholder="Nguyễn Văn A – Trưởng phòng kỹ thuật" hint="Ngăn cách bằng dấu phẩy" />
          <Input name="sameAs" label="Liên kết sameAs" placeholder="https://facebook.com/..., https://youtube.com/..." hint="Ngăn cách bằng dấu phẩy" />
        </div>
      </details>
      {state?.error && <SystemNotice tone="red">{state.error}</SystemNotice>}
      <Button type="submit" variant="primary" loading={pending} fullWidth>Tạo dự án</Button>
    </form>
  );
}
