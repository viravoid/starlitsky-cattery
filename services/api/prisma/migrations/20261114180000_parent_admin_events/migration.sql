CREATE TABLE "parent_admin_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor_id" TEXT,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "details_json" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "parent_admin_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parent_admin_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "parent_admin_events_user_id_created_at_idx" ON "parent_admin_events"("user_id", "created_at");

-- Preserve one effective parent grant per user while retaining older grants as revoked history.
UPDATE "user_roles"
SET "revoked_at" = CURRENT_TIMESTAMP
WHERE "role" = 'parent' AND "revoked_at" IS NULL
  AND "id" NOT IN (
    SELECT MIN("id") FROM "user_roles"
    WHERE "role" = 'parent' AND "revoked_at" IS NULL GROUP BY "user_id"
  );
CREATE UNIQUE INDEX "user_roles_one_active_parent_per_user"
ON "user_roles"("user_id") WHERE "role" = 'parent' AND "revoked_at" IS NULL;
