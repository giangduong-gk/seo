-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "industry" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'vi-VN',
    "brandVoice" TEXT,
    "entityProfile" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "intent" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'done',
    "model" TEXT NOT NULL,
    "research" TEXT,
    "result" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cluster" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pillarKeyword" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Cluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brief" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clusterId" TEXT,
    "targetKeyword" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "briefId" TEXT,
    "targetKeyword" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL DEFAULT '',
    "bodyMarkdown" TEXT NOT NULL DEFAULT '',
    "jsonLd" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleRevision" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "seoScore" INTEGER NOT NULL,
    "geoScore" INTEGER NOT NULL,
    "criteria" TEXT NOT NULL,
    "model" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_projectId_term_key" ON "Keyword"("projectId", "term");

-- CreateIndex
CREATE INDEX "Analysis_projectId_createdAt_idx" ON "Analysis"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Analysis_keywordId_idx" ON "Analysis"("keywordId");

-- CreateIndex
CREATE INDEX "AiUsage_projectId_createdAt_idx" ON "AiUsage"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Cluster_projectId_createdAt_idx" ON "Cluster"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Brief_projectId_createdAt_idx" ON "Brief"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Brief_clusterId_idx" ON "Brief"("clusterId");

-- CreateIndex
CREATE INDEX "Article_projectId_updatedAt_idx" ON "Article"("projectId", "updatedAt");

-- CreateIndex
CREATE INDEX "Article_briefId_idx" ON "Article"("briefId");

-- CreateIndex
CREATE INDEX "ArticleRevision_articleId_createdAt_idx" ON "ArticleRevision"("articleId", "createdAt");

-- CreateIndex
CREATE INDEX "Score_articleId_createdAt_idx" ON "Score"("articleId", "createdAt");

-- AddForeignKey
ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cluster" ADD CONSTRAINT "Cluster_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "Brief"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleRevision" ADD CONSTRAINT "ArticleRevision_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ───────────────────────────────────────────────────────────────────────────
-- Bảo mật (Supabase): bật RLS cho mọi bảng và KHÔNG tạo policy nào
-- → role anon/authenticated (Data API, key công khai) không đọc/ghi được dòng nào.
-- App truy cập qua Prisma bằng role chủ bảng (bỏ qua RLS) và tự kiểm tra quyền ở server.
-- Schema `seo` vốn không nằm trong danh sách schema Data API mở ra; đây là lớp phòng thủ thứ hai.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Keyword" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Analysis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiUsage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Cluster" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Brief" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Article" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArticleRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Score" ENABLE ROW LEVEL SECURITY;

-- Thu hồi mọi quyền của role công khai Supabase (bỏ qua khi chạy trên Postgres thường không có các role này)
DO $$
DECLARE s text := current_schema();
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM anon, authenticated', s);
    EXECUTE format('REVOKE ALL ON SCHEMA %I FROM anon, authenticated', s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM anon, authenticated', s);
  END IF;
END $$;
