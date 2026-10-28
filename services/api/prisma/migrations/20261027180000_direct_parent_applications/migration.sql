-- CreateTable
CREATE TABLE "parent_phone_verifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "token_hash" TEXT,
    "phone" TEXT,
    "verified_at" DATETIME,
    "expires_at" DATETIME NOT NULL,
    "consumed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "parent_phone_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_parent_applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "invite_id" TEXT,
    "pending_dedup_key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "display_name" TEXT NOT NULL,
    "real_name" TEXT,
    "contact_phone" TEXT,
    "contact_phone_source" TEXT NOT NULL DEFAULT 'unknown',
    "contact_phone_verified_at" DATETIME,
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
INSERT INTO "new_parent_applications" ("admin_note", "approved_parent_profile_id", "city", "contact_phone", "contact_wechat", "created_at", "display_name", "existing_cat_claims_json", "id", "invite_id", "new_cats_json", "pending_dedup_key", "real_name", "reviewed_at", "reviewed_by", "status", "updated_at", "user_id") SELECT "admin_note", "approved_parent_profile_id", "city", "contact_phone", "contact_wechat", "created_at", "display_name", "existing_cat_claims_json", "id", "invite_id", "new_cats_json", "pending_dedup_key", "real_name", "reviewed_at", "reviewed_by", "status", "updated_at", "user_id" FROM "parent_applications";
DROP TABLE "parent_applications";
ALTER TABLE "new_parent_applications" RENAME TO "parent_applications";
CREATE UNIQUE INDEX "parent_applications_pending_dedup_key_key" ON "parent_applications"("pending_dedup_key");
CREATE INDEX "parent_applications_user_id_idx" ON "parent_applications"("user_id");
CREATE INDEX "parent_applications_invite_id_idx" ON "parent_applications"("invite_id");
CREATE INDEX "parent_applications_status_idx" ON "parent_applications"("status");
CREATE INDEX "parent_applications_created_at_idx" ON "parent_applications"("created_at");
CREATE TABLE "new_parent_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "real_name" TEXT,
    "contact_phone" TEXT,
    "contact_phone_source" TEXT NOT NULL DEFAULT 'unknown',
    "contact_phone_verified_at" DATETIME,
    "contact_wechat" TEXT,
    "city" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "activated_at" DATETIME,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "parent_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_parent_profiles" ("activated_at", "city", "contact_phone", "contact_wechat", "created_at", "display_name", "id", "note", "real_name", "status", "updated_at", "user_id") SELECT "activated_at", "city", "contact_phone", "contact_wechat", "created_at", "display_name", "id", "note", "real_name", "status", "updated_at", "user_id" FROM "parent_profiles";
DROP TABLE "parent_profiles";
ALTER TABLE "new_parent_profiles" RENAME TO "parent_profiles";
CREATE UNIQUE INDEX "parent_profiles_user_id_key" ON "parent_profiles"("user_id");
CREATE INDEX "parent_profiles_status_idx" ON "parent_profiles"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "parent_phone_verifications_code_hash_key" ON "parent_phone_verifications"("code_hash");

-- CreateIndex
CREATE UNIQUE INDEX "parent_phone_verifications_token_hash_key" ON "parent_phone_verifications"("token_hash");

-- CreateIndex
CREATE INDEX "parent_phone_verifications_user_id_created_at_idx" ON "parent_phone_verifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "parent_phone_verifications_expires_at_idx" ON "parent_phone_verifications"("expires_at");
