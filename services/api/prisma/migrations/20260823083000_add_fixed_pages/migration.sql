-- CreateTable
CREATE TABLE "fixed_pages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "seo_title" TEXT,
    "seo_description" TEXT,
    "content_schema_version" INTEGER NOT NULL DEFAULT 1,
    "content_json" JSONB,
    "published_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "fixed_pages_slug_key" ON "fixed_pages"("slug");

-- CreateIndex
CREATE INDEX "fixed_pages_status_idx" ON "fixed_pages"("status");

-- CreateIndex
CREATE INDEX "fixed_pages_published_at_idx" ON "fixed_pages"("published_at");

-- Seed known fixed pages. New fixed pages should be added deliberately by
-- migration/code review, not created ad hoc through the admin API.
INSERT INTO "fixed_pages" (
    "id",
    "slug",
    "title",
    "status",
    "content_schema_version",
    "content_json",
    "updated_at"
) VALUES
    ('fixed-page-home', 'home', '首页', 'draft', 1, '{}', CURRENT_TIMESTAMP),
    ('fixed-page-about', 'about', '猫舍介绍', 'draft', 1, '{}', CURRENT_TIMESTAMP),
    ('fixed-page-philosophy', 'philosophy', '繁育理念', 'draft', 1, '{}', CURRENT_TIMESTAMP),
    ('fixed-page-environment', 'environment', '猫舍环境', 'draft', 1, '{}', CURRENT_TIMESTAMP),
    ('fixed-page-feeding', 'feeding', '喂养体系', 'draft', 1, '{}', CURRENT_TIMESTAMP),
    ('fixed-page-process', 'process', '选猫流程', 'draft', 1, '{}', CURRENT_TIMESTAMP),
    ('fixed-page-aftercare', 'aftercare', '售后保障', 'draft', 1, '{}', CURRENT_TIMESTAMP),
    ('fixed-page-contact', 'contact', '联系方式', 'draft', 1, '{}', CURRENT_TIMESTAMP),
    ('fixed-page-questionnaire', 'questionnaire', '选猫问卷', 'draft', 1, '{}', CURRENT_TIMESTAMP),
    ('fixed-page-breeding-plan', 'breeding-plan', '繁育计划', 'draft', 1, '{}', CURRENT_TIMESTAMP);
