CREATE TABLE "admin_login_challenges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scene_credential_hash" TEXT NOT NULL,
    "poll_credential_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by_user_id" TEXT,
    "expires_at" DATETIME NOT NULL,
    "scanned_at" DATETIME,
    "approved_at" DATETIME,
    "consumed_at" DATETIME,
    "cancelled_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "admin_login_challenges_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "admin_login_challenges_scene_credential_hash_key" ON "admin_login_challenges"("scene_credential_hash");
CREATE UNIQUE INDEX "admin_login_challenges_poll_credential_hash_key" ON "admin_login_challenges"("poll_credential_hash");
CREATE INDEX "admin_login_challenges_status_idx" ON "admin_login_challenges"("status");
CREATE INDEX "admin_login_challenges_expires_at_idx" ON "admin_login_challenges"("expires_at");
CREATE INDEX "admin_login_challenges_approved_by_user_id_idx" ON "admin_login_challenges"("approved_by_user_id");
