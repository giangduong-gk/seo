# Bảo mật

## Báo cáo lỗ hổng

Không mở issue công khai. Dùng **GitHub → Security → Report a vulnerability** (private advisory) của repo, hoặc liên hệ trực tiếp chủ repo. Gửi kèm mô tả, cách tái hiện và mức ảnh hưởng.

## Bí mật (secrets)

| Bí mật | Nơi lưu | Không bao giờ |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `apps/web/.env` (local), biến môi trường Vercel | Commit, dán vào issue/chat, đặt prefix `NEXT_PUBLIC_` |
| Mật khẩu DB (`DATABASE_URL`, `DIRECT_URL`) | Như trên | Commit, ghi vào log |
| Supabase `service_role` key | Không dùng trong app hiện tại | Đưa xuống trình duyệt |

- `.env` bị Git bỏ qua. Chỉ `.env.example` (giá trị mẫu) được commit.
- **Xoay vòng khoá** ngay khi nghi lộ (đã dán vào chat, log, ảnh chụp màn hình…): tạo khoá mới ở console.anthropic.com, cập nhật biến môi trường, rồi thu hồi khoá cũ.
- Dùng khoá khác nhau cho dev và production, đồng thời đặt giới hạn chi tiêu (spend limit) trên Anthropic Console.

## Mô hình truy cập hiện tại

- **Chưa có đăng nhập.** Bất kỳ ai truy cập được URL đều dùng được mọi tính năng, kể cả các tính năng tốn chi phí AI. Khi deploy phải bật bảo vệ ở tầng hosting (Vercel Deployment Protection). Đăng nhập và phân quyền theo dự án nằm trong lộ trình kế tiếp.
- **Database:** bảng trong schema `seo`, RLS bật và không có policy, quyền `anon`/`authenticated` đã thu hồi. Key công khai của Supabase không truy cập được dữ liệu. Xem [docs/database.md](docs/database.md#2-schema-seo-và-bảo-mật).
- **JSON-LD** xuất ra được escape chuỗi `</` để không phá thẻ `<script>`. Nội dung phân tích/brief hiển thị qua component React (`RichText`), không dùng `dangerouslySetInnerHTML`.

## Rủi ro đã biết

| Mục | Mô tả | Xử lý dự kiến |
| --- | --- | --- |
| Xem trước bài viết | `ArticleEditor` render Markdown → HTML bằng `marked` rồi đưa vào `dangerouslySetInnerHTML` **chưa sanitize**. HTML thô trong bài (do người dùng gõ hoặc AI sinh) sẽ chạy trong trình duyệt. Hiện tại chỉ người soạn tự thấy bài của mình nên rủi ro thấp. | **Bắt buộc sửa trước khi có nhiều thành viên** (giai đoạn Auth): sanitize bằng DOMPurify hoặc tắt HTML thô trong `marked` |
| Không có đăng nhập | Xem mục trên | Giai đoạn Auth |

## Phụ thuộc

Cập nhật bản vá bảo mật của Next.js, Prisma và `@anthropic-ai/sdk` định kỳ (`npm outdated`, `npm audit` trong `apps/web`).
