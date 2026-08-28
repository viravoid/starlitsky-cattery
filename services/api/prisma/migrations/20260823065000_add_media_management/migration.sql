-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'image',
    "source_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "title" TEXT,
    "alt_text" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "duration_seconds" INTEGER,
    "checksum" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata_json" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "media_bindings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "media_id" TEXT NOT NULL,
    "owner_type" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "usage" TEXT NOT NULL DEFAULT 'gallery',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "visibility" TEXT NOT NULL DEFAULT 'visible',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "media_bindings_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "media_assets_kind_idx" ON "media_assets"("kind");

-- CreateIndex
CREATE INDEX "media_assets_status_idx" ON "media_assets"("status");

-- CreateIndex
CREATE INDEX "media_assets_created_at_idx" ON "media_assets"("created_at");

-- CreateIndex
CREATE INDEX "media_bindings_media_id_idx" ON "media_bindings"("media_id");

-- CreateIndex
CREATE INDEX "media_bindings_owner_type_owner_id_idx" ON "media_bindings"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "media_bindings_usage_idx" ON "media_bindings"("usage");

-- CreateIndex
CREATE INDEX "media_bindings_visibility_idx" ON "media_bindings"("visibility");
