# ADR 0001 — Một ứng dụng Next.js cho cả UI và server

- **Trạng thái:** Chấp nhận · 10/10/2026

## Bối cảnh

MVP cần ra nhanh với đội nhỏ. Các tác vụ AI chạy lâu (1–3 phút), cần stream kết quả ra trình duyệt. Dữ liệu thì có quan hệ chặt chẽ (dự án → từ khoá → cluster → brief → bài viết).

## Quyết định

Dùng **Next.js 15 App Router** làm ứng dụng duy nhất:
- server component đọc dữ liệu trực tiếp qua Prisma;
- server action cho các thao tác ghi (tạo dự án, chạy phân tích, lưu cluster…);
- route handler cho phần cần HTTP thuần: stream SSE khi viết bài và tải file xuất.

## Hệ quả

- ✅ Một codebase, một lần deploy, type an toàn từ DB tới UI, không phải duy trì API riêng.
- ✅ Khoá Claude và DB chỉ tồn tại ở server.
- ⚠️ Tác vụ AI chạy trong request: phụ thuộc giới hạn thời gian của nền tảng serverless. Khi tải tăng → chuyển sang hàng đợi (pgmq) + worker (đã có trong lộ trình).
- ⚠️ Muốn mở API cho bên thứ ba thì phải bổ sung route handler có xác thực.

## Phương án đã cân nhắc

- **Frontend SPA + backend riêng (NestJS/FastAPI):** linh hoạt hơn nhưng gấp đôi công vận hành ở giai đoạn MVP.
- **Edge runtime:** không phù hợp vì Prisma và các lời gọi dài cần Node runtime.
