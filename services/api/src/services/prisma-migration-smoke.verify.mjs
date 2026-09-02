import assert from "node:assert/strict";
import { prisma } from "../db/prisma.mjs";

try {
  const userCount = await prisma.user.count();
  assert.equal(Number.isInteger(userCount), true);
  console.log("Prisma migration smoke verification passed");
} finally {
  await prisma.$disconnect();
}
