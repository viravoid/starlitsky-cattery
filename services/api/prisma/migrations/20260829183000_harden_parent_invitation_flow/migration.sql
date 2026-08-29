-- Add QR scene lookup without storing the clear QR credential.
ALTER TABLE "parent_invites" ADD COLUMN "qr_scene_hash" TEXT;

-- Guard against concurrent duplicate pending applications from the same user.
ALTER TABLE "parent_applications" ADD COLUMN "pending_dedup_key" TEXT;

-- Guard against duplicate active parent-cat links created by concurrent approvals.
ALTER TABLE "parent_cat_links" ADD COLUMN "active_dedup_key" TEXT;

CREATE UNIQUE INDEX "parent_invites_qr_scene_hash_key" ON "parent_invites"("qr_scene_hash");
CREATE UNIQUE INDEX "parent_applications_pending_dedup_key_key" ON "parent_applications"("pending_dedup_key");
CREATE UNIQUE INDEX "parent_cat_links_active_dedup_key_key" ON "parent_cat_links"("active_dedup_key");
