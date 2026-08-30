CREATE TABLE "selection_applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "client_dedup_key" TEXT,
    "contact_name" TEXT NOT NULL,
    "contact_gender" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "contact_age" TEXT NOT NULL,
    "contact_job" TEXT NOT NULL,
    "contact_city" TEXT NOT NULL,
    "cat_experience_json" JSONB NOT NULL,
    "existing_pets_json" JSONB NOT NULL,
    "living_environment_json" JSONB NOT NULL,
    "maine_coon_knowledge" TEXT,
    "preferences_json" JSONB NOT NULL,
    "commitments_json" JSONB NOT NULL,
    "additional_note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "submitted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "admin_note" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "selection_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "selection_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "selection_applications_client_dedup_key_key" ON "selection_applications"("client_dedup_key");
CREATE INDEX "selection_applications_user_id_idx" ON "selection_applications"("user_id");
CREATE INDEX "selection_applications_status_idx" ON "selection_applications"("status");
CREATE INDEX "selection_applications_submitted_at_idx" ON "selection_applications"("submitted_at");
