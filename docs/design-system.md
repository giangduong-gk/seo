# Design system

Giao diện RankMind dựng trên **AiDoIt Design System v1.13.2**: giao diện tối, điểm nhấn màu volt, typography Archivo/Inter/Geist Mono. Token gốc được copy nguyên vào `apps/web/src/styles/tokens/` và **không sửa trực tiếp**. Mọi điều chỉnh cấp ứng dụng ghi trong `app-overrides.css`, kèm lý do.

## 1. Tầng style

| File | Vai trò |
| --- | --- |
| `styles/tokens/*.css` | Token gốc AiDoIt: `colors`, `typography`, `spacing`, `layout`, `motion`, `components`, `charts`, `themes`, `responsive` |
| `styles/tokens/app-overrides.css` | Ghi đè có lý do (xem mục 3) |
| `styles/base.css` | Reset và style phần tử gốc |
| `styles/motion.css` | Lớp hiệu ứng dùng chung (mục 4) |
| `app/globals.css` | Tiện ích bố cục (`container`, `stack`, `grid-kpi`, `page-head`…) |
| `components/**/X.module.css` | Style cục bộ từng component (CSS Modules) |

Font nạp qua `next/font` (subset `vietnamese`): **Archivo** (display, có trục `wdth`), **Inter** (body), **Geist Mono** (số liệu, mã).

## 2. Quy tắc màu

- Chỉ dùng biến token (`var(--fg-1)`, `var(--volt)`, `var(--line-2)`…). **Không hard-code** hex/rgb/hsl trong `src/`.
- `npm run lint:tokens` (`apps/web/scripts/lint-tokens.mjs`) quét `src/` và báo mọi màu literal nằm ngoài `styles/tokens/`. CI chạy lệnh này ở chế độ **bắt buộc**.
- Trường hợp bắt buộc dùng giá trị thật (vd. `<meta name="theme-color">`, mask alpha, màu React Flow truyền qua prop) thì thêm chú thích `/* lint-allow-color: <lý do> */` trên cùng dòng.

## 3. Ghi đè hiện có (`app-overrides.css`)

| Token | Gốc → mới | Lý do |
| --- | --- | --- |
| `--fg-3`, `--meta-text` | `#6E737A` → `#82878E` | Gốc chỉ đạt 3,7:1 trên nền; giá trị mới đạt 4,9–5,2:1 (WCAG AA), vẫn giữ thứ bậc fg-2 > fg-3 > fg-4 |
| `--control-h-s`, `--icon-btn-s` (khi `pointer: coarse`) | 36px → 40px | Vùng chạm tối thiểu trên màn cảm ứng |

## 4. Motion

Dựa trên token `--dur-*`, `--ease-*`, `--motion-stagger`. Lớp dùng chung trong `styles/motion.css`:

| Lớp | Hiệu ứng |
| --- | --- |
| `.stagger` | Các con xuất hiện lần lượt khi vào trang |
| `.reveal` | Hiện dần theo cuộn (scroll-driven animation) |
| `.row-link`, `.card-hover` | Trạng thái hover/active/focus cho hàng và thẻ |
| `.grow-x` | Thanh tiến độ/biểu đồ mọc từ trái |
| `.skeleton` | Khối chờ tải |
| `.scroll-x`, `.fade-x` | Dải cuộn ngang có snap và mờ hai mép |

Tất cả hiệu ứng tắt khi người dùng bật `prefers-reduced-motion`. Bộ test `motion.spec.ts` kiểm tra điều này.

## 5. Component

- **`components/ui/`**: Button, Field, Badge, Chip, Progress, Panel, Table, EmptyState, SystemNotice, Toast, Skeleton, Stat, BarList, Kbd. Import qua `@/components/ui`.
- **Sơ đồ cluster** (`components/cluster/`): React Flow, cạnh cây dạng smooth-step bo góc 12px, cạnh chéo nổi, marker SVG riêng, chuyển hướng Ngang/Dọc, tự sắp xếp (phím `L`).
- **Wordmark**: chữ hoa `RANK` màu volt + `MIND` màu `--fg-1` (`components/shell/Shell.tsx`).

## 6. Accessibility (được kiểm tra tự động)

- axe-core WCAG 2.0 A/AA + 2.1 AA trên 10 trang, cả desktop và phone.
- Tương phản chữ ≥ 4,5:1. Vùng chạm ≥ 40px trên cảm ứng. Focus luôn nhìn thấy. Có skip link. Phím Escape đóng menu.
- Landmark có tên duy nhất. Mỗi trang có đúng một H1. Không tràn ngang ở 360/768/1024/1440px. CLS < 0,1.

Chi tiết các gate và ngưỡng: [Kiểm thử → UX quality gates](testing.md#3a-ux-quality-gates).
