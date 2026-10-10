// Xoá toàn bộ dữ liệu trong DB e2e (giữ nguyên file để dev server đang mở không bị "readonly database").
// Chạy với DATABASE_URL=file:./test.db — được global-setup.ts gọi trước khi seed.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
await prisma.$transaction([
  prisma.score.deleteMany(),
  prisma.articleRevision.deleteMany(),
  prisma.article.deleteMany(),
  prisma.brief.deleteMany(),
  prisma.cluster.deleteMany(),
  prisma.analysis.deleteMany(),
  prisma.aiUsage.deleteMany(),
  prisma.keyword.deleteMany(),
  prisma.project.deleteMany(),
]);
console.log("e2e DB reset:", process.env.DATABASE_URL);
await prisma.$disconnect();
