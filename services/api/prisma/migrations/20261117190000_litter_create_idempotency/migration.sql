ALTER TABLE "litters" ADD COLUMN "create_request_identity" TEXT;
ALTER TABLE "litters" ADD COLUMN "create_request_hash" TEXT;
CREATE UNIQUE INDEX "litters_create_request_identity_key" ON "litters"("create_request_identity");
