-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wechat_openid" TEXT,
    "wechat_unionid" TEXT,
    "nickname" TEXT,
    "avatar_url" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_login_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "granted_by" TEXT,
    "granted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" DATETIME,
    CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "parent_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "real_name" TEXT,
    "contact_phone" TEXT,
    "contact_wechat" TEXT,
    "city" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "activated_at" DATETIME,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "parent_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "color" TEXT,
    "birthday" DATETIME,
    "lifecycle_status" TEXT NOT NULL DEFAULT 'growing',
    "personality" TEXT,
    "story_json" JSONB,
    "visibility" TEXT NOT NULL DEFAULT 'visible',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "breeding_cat_profiles" (
    "cat_id" TEXT NOT NULL PRIMARY KEY,
    "breeding_role" TEXT NOT NULL,
    "reproductive_state" TEXT NOT NULL,
    "status_label" TEXT,
    "trait" TEXT,
    "source" TEXT,
    "health_summary" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "breeding_cat_profiles_cat_id_fkey" FOREIGN KEY ("cat_id") REFERENCES "cats" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "kitten_profiles" (
    "cat_id" TEXT NOT NULL PRIMARY KEY,
    "litter_id" TEXT NOT NULL,
    "sale_status" TEXT NOT NULL DEFAULT 'evaluating',
    "price_text" TEXT,
    "structure_rating_json" JSONB,
    "adopted_at" DATETIME,
    CONSTRAINT "kitten_profiles_cat_id_fkey" FOREIGN KEY ("cat_id") REFERENCES "cats" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "kitten_profiles_litter_id_fkey" FOREIGN KEY ("litter_id") REFERENCES "litters" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "litters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "birth_date" DATETIME,
    "expected_birth_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "father_cat_id" TEXT NOT NULL,
    "mother_cat_id" TEXT NOT NULL,
    "possible_colors_json" JSONB,
    "color_note" TEXT,
    "note" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'visible',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "litters_father_cat_id_fkey" FOREIGN KEY ("father_cat_id") REFERENCES "cats" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "litters_mother_cat_id_fkey" FOREIGN KEY ("mother_cat_id") REFERENCES "cats" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "parent_cat_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parent_profile_id" TEXT NOT NULL,
    "cat_id" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "started_at" DATETIME,
    "ended_at" DATETIME,
    "note" TEXT,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "parent_cat_links_parent_profile_id_fkey" FOREIGN KEY ("parent_profile_id") REFERENCES "parent_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "parent_cat_links_cat_id_fkey" FOREIGN KEY ("cat_id") REFERENCES "cats" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "parent_cat_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wechat_openid_key" ON "users"("wechat_openid");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_idx" ON "user_roles"("role");

-- CreateIndex
CREATE UNIQUE INDEX "parent_profiles_user_id_key" ON "parent_profiles"("user_id");

-- CreateIndex
CREATE INDEX "parent_profiles_status_idx" ON "parent_profiles"("status");

-- CreateIndex
CREATE INDEX "cats_lifecycle_status_idx" ON "cats"("lifecycle_status");

-- CreateIndex
CREATE INDEX "cats_visibility_idx" ON "cats"("visibility");

-- CreateIndex
CREATE INDEX "breeding_cat_profiles_breeding_role_idx" ON "breeding_cat_profiles"("breeding_role");

-- CreateIndex
CREATE INDEX "breeding_cat_profiles_reproductive_state_idx" ON "breeding_cat_profiles"("reproductive_state");

-- CreateIndex
CREATE INDEX "kitten_profiles_litter_id_idx" ON "kitten_profiles"("litter_id");

-- CreateIndex
CREATE INDEX "kitten_profiles_sale_status_idx" ON "kitten_profiles"("sale_status");

-- CreateIndex
CREATE INDEX "litters_father_cat_id_idx" ON "litters"("father_cat_id");

-- CreateIndex
CREATE INDEX "litters_mother_cat_id_idx" ON "litters"("mother_cat_id");

-- CreateIndex
CREATE INDEX "litters_status_idx" ON "litters"("status");

-- CreateIndex
CREATE INDEX "litters_visibility_idx" ON "litters"("visibility");

-- CreateIndex
CREATE INDEX "parent_cat_links_parent_profile_id_idx" ON "parent_cat_links"("parent_profile_id");

-- CreateIndex
CREATE INDEX "parent_cat_links_cat_id_idx" ON "parent_cat_links"("cat_id");

-- CreateIndex
CREATE INDEX "parent_cat_links_relationship_idx" ON "parent_cat_links"("relationship");

-- CreateIndex
CREATE INDEX "parent_cat_links_status_idx" ON "parent_cat_links"("status");
