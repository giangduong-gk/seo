// Seed dữ liệu mẫu để xem UI khi chưa có API key: node prisma/seed.mjs
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
const prisma = new PrismaClient();
const sample = JSON.parse(readFileSync(new URL("./fixtures/sample-analysis.json", import.meta.url), "utf8"));

const project = await prisma.project.upsert({
  where: { id: "demo-project" },
  update: {},
  create: {
    id: "demo-project", name: "Điện Thoại Giá Kho", domain: "giakho.vn", industry: "Bán lẻ điện thoại", locale: "vi-VN",
    brandVoice: "Thân thiện, chuyên gia, đi thẳng vào vấn đề",
    entityProfile: JSON.stringify({ organization: "Giá Kho Group", products: ["iPhone", "Samsung", "Trả góp 0%"], authors: ["Chuyên gia Giá Kho"], sameAs: ["https://facebook.com/giakho"] }),
  },
});
const keyword = await prisma.keyword.upsert({
  where: { projectId_term: { projectId: project.id, term: sample.keyword } },
  update: { intent: sample.intent },
  create: { projectId: project.id, term: sample.keyword, intent: sample.intent },
});
await prisma.analysis.create({ data: { projectId: project.id, keywordId: keyword.id, status: "done", model: "claude-opus-5-5", result: JSON.stringify(sample), research: null } });
await prisma.aiUsage.create({ data: { projectId: project.id, feature: "keyword_analysis", model: "claude-opus-5-5", inputTokens: 6200, outputTokens: 4100, cacheReadTokens: 3800, cacheWriteTokens: 0, costUsd: (6200 * 4 + 4100 * 20 + 3800 * 0.2) / 1e6 } });
console.log("Seeded project", project.id);
await prisma.$disconnect();
