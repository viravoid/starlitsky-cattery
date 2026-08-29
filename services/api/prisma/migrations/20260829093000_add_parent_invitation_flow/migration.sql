-- CreateTable
CREATE TABLE "parent_invites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token_hash" TEXT NOT NULL,
    "short_code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" DATETIME,
    "note" TEXT,
    "created_by" TEXT,
    "revoked_by" TEXT,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "parent_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parent_invites_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "parent_applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "invite_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "display_name" TEXT NOT NULL,
    "real_name" TEXT,
    "contact_phone" TEXT,
    "contact_wechat" TEXT,
    "city" TEXT,
    "existing_cat_claims_json" JSONB,
    "new_cats_json" JSONB,
    "admin_note" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" DATETIME,
    "approved_parent_profile_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "parent_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "parent_applications_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "parent_invites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parent_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parent_applications_approved_parent_profile_id_fkey" FOREIGN KEY ("approved_parent_profile_id") REFERENCES "parent_profiles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "parent_invites_token_hash_key" ON "parent_invites"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "parent_invites_short_code_key" ON "parent_invites"("short_code");

-- CreateIndex
CREATE INDEX "parent_invites_short_code_idx" ON "parent_invites"("short_code");

-- CreateIndex
CREATE INDEX "parent_invites_status_idx" ON "parent_invites"("status");

-- CreateIndex
CREATE INDEX "parent_invites_expires_at_idx" ON "parent_invites"("expires_at");

-- CreateIndex
CREATE INDEX "parent_applications_user_id_idx" ON "parent_applications"("user_id");

-- CreateIndex
CREATE INDEX "parent_applications_invite_id_idx" ON "parent_applications"("invite_id");

-- CreateIndex
CREATE INDEX "parent_applications_status_idx" ON "parent_applications"("status");

-- CreateIndex
CREATE INDEX "parent_applications_created_at_idx" ON "parent_applications"("created_at");
