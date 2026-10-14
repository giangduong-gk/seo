# Đóng góp cho RankMind

## Quy trình

1. Tạo nhánh từ `main`, đặt tên theo loại việc: `feat/<mo-ta>`, `fix/<mo-ta>`, `docs/<mo-ta>`, `chore/<mo-ta>`.
2. Code + test. Chạy `npm run check` ở gốc repo (typecheck · unit · token lint) trước khi đẩy.
3. Nếu sửa UI hoặc luồng nghiệp vụ: chạy thêm `npm run test:e2e` (cần database `seo_test`, xem [docs/testing.md](docs/testing.md)).
4. Mở Pull Request: mô tả *vì sao*, ảnh chụp trước/sau với thay đổi UI, ghi rõ migration mới (nếu có).
5. CI phải xanh trước khi merge. Squash merge, tiêu đề PR là commit message.

## Commit message

Tiếng Anh, thể mệnh lệnh, dòng đầu ≤ 72 ký tự, phần thân giải thích *vì sao*:

```
Cluster editor: keep node positions when switching layout direction

React Flow recomputed handles before positions were restored, so edges
attached to stale anchors. Update node internals after the direction flips.
```

## Quy ước code

- TypeScript strict. Không dùng `any` nếu chưa có lý do ghi kèm.
- Logic nghiệp vụ nằm trong `src/lib/`. Component chỉ hiển thị dữ liệu.
- Validate input bằng Zod; output AI bằng `zodOutputFormat` ([docs/ai-pipeline.md](docs/ai-pipeline.md)).
- Màu chỉ lấy từ token; `npm run lint:tokens` phải sạch ([docs/design-system.md](docs/design-system.md)).
- Text giao diện bằng tiếng Việt, có dấu đầy đủ. Tên biến, hàm và comment kỹ thuật được phép dùng tiếng Anh hoặc tiếng Việt, nhưng trong một file phải thống nhất một cách.
- Thay đổi schema DB: tạo migration qua `npm run db:migrate:dev`. Bảng mới phải bật RLS ([docs/database.md](docs/database.md#3-migration)).
- Quyết định kiến trúc mới: thêm ADR trong `docs/decisions/`.

## Kiểm thử

| Thay đổi | Test cần có |
| --- | --- |
| Hàm trong `src/lib/` | Unit test Vitest trong `tests/unit/` |
| Trang/luồng mới | Smoke e2e trong `tests/e2e/` và thêm trang vào `UX_PAGES` (`tests/e2e/ux.ts`) để được kiểm tra a11y/layout |
| Sửa lỗi | Test tái hiện lỗi trước khi sửa |

Không bỏ qua, vô hiệu hoá hay đánh dấu "flaky" một test để CI xanh. Hãy tìm nguyên nhân gốc.

## Bảo mật

Không commit `.env`, API key, mật khẩu DB hay `service_role` key. Xem [SECURITY.md](SECURITY.md).
