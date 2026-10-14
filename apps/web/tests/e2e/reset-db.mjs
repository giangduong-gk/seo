import { PrismaClient } from "@prisma/client";

// Xoá toàn bộ dữ liệu trong DB e2e (giữ schema/migration). global-setup.ts gọi trước khi seed,
// với DATABASE_URL = E2E_DATABASE_URL (Postgres `seo_test`) — không bao giờ chạy trên DB thật.
if (!/\/seo_test(\?|$)/.test(process.env.DATABASE_URL ?? "")) {
  console.error("reset-db: từ chối xoá — DATABASE_URL không trỏ vào database seo_test.");
  process.exit(1);
}
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
