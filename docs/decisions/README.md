# Architecture Decision Records (ADR)

Mỗi quyết định kiến trúc quan trọng được ghi thành một file ngắn: bối cảnh → quyết định → hệ quả. ADR đã chấp nhận thì **không sửa nội dung**. Khi đổi hướng, viết ADR mới và đánh dấu ADR cũ là "Thay thế bởi …".

| # | Quyết định | Trạng thái |
| --- | --- | --- |
| [0001](0001-nextjs-single-app.md) | Một ứng dụng Next.js (UI + server) thay vì tách frontend/backend | Chấp nhận |
| [0002](0002-postgres-supabase-rls.md) | PostgreSQL trên Supabase, schema riêng `seo`, RLS mặc định từ chối | Chấp nhận |
| [0003](0003-claude-structured-output.md) | Claude với structured output (Zod), prompt caching, streaming | Chấp nhận |
| [0004](0004-monorepo-layout.md) | Bố cục monorepo `apps/` + `docs/` | Chấp nhận |

Mẫu ADR mới: copy một file hiện có, đánh số tiếp theo, giữ các mục *Bối cảnh · Quyết định · Hệ quả · Phương án đã cân nhắc*.
