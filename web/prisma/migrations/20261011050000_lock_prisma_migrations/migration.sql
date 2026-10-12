-- Bảng lịch sử migration do Prisma tự tạo: bật RLS như các bảng khác (không policy → role công khai không truy cập được).
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
