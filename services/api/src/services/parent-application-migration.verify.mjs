import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const database = new DatabaseSync(":memory:");
database.exec(`
PRAGMA foreign_keys=ON;
CREATE TABLE users (id TEXT PRIMARY KEY);
CREATE TABLE parent_invites (id TEXT PRIMARY KEY);
CREATE TABLE parent_profiles (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, display_name TEXT NOT NULL,
  real_name TEXT, contact_phone TEXT, contact_wechat TEXT, city TEXT,
  status TEXT NOT NULL DEFAULT 'active', activated_at DATETIME, note TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE parent_applications (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, invite_id TEXT NOT NULL,
  pending_dedup_key TEXT, status TEXT NOT NULL DEFAULT 'pending',
  display_name TEXT NOT NULL, real_name TEXT, contact_phone TEXT,
  contact_wechat TEXT, city TEXT, existing_cat_claims_json JSONB,
  new_cats_json JSONB, admin_note TEXT, reviewed_by TEXT, reviewed_at DATETIME,
  approved_parent_profile_id TEXT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(invite_id) REFERENCES parent_invites(id),
  FOREIGN KEY(approved_parent_profile_id) REFERENCES parent_profiles(id)
);
INSERT INTO users(id) VALUES ('legacy-user'), ('new-user');
INSERT INTO parent_invites(id) VALUES ('legacy-invite');
INSERT INTO parent_profiles(id, user_id, display_name, contact_phone, updated_at)
VALUES ('legacy-profile', 'legacy-user', 'Legacy', '13800000000', CURRENT_TIMESTAMP);
INSERT INTO parent_applications(id, user_id, invite_id, display_name, contact_phone,
  status, approved_parent_profile_id, updated_at)
VALUES ('legacy-application', 'legacy-user', 'legacy-invite', 'Legacy',
  '13800000000', 'approved', 'legacy-profile', CURRENT_TIMESTAMP);
`);

const migration = readFileSync(
  new URL(
    "../../prisma/migrations/20261027180000_direct_parent_applications/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
database.exec(migration);
const old = database
  .prepare(
    "SELECT invite_id, contact_phone, contact_phone_source, approved_parent_profile_id FROM parent_applications WHERE id = 'legacy-application'",
  )
  .get();
assert.deepEqual(
  { ...old },
  {
    invite_id: "legacy-invite",
    contact_phone: "13800000000",
    contact_phone_source: "unknown",
    approved_parent_profile_id: "legacy-profile",
  },
);
assert.equal(
  database
    .prepare("SELECT contact_phone_source FROM parent_profiles WHERE id = 'legacy-profile'")
    .get().contact_phone_source,
  "unknown",
);
database.exec(`INSERT INTO parent_applications(id, user_id, invite_id, display_name,
  contact_wechat, contact_phone_source, updated_at)
  VALUES ('direct-application', 'new-user', NULL, 'Direct', 'wechat-contact', 'none', CURRENT_TIMESTAMP)`);
assert.equal(
  database
    .prepare("SELECT invite_id FROM parent_applications WHERE id = 'direct-application'")
    .get().invite_id,
  null,
);
assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
database.close();
console.info("parent application migration compatibility verification passed");
