import { prisma } from "../db/prisma.mjs";

export async function getAdminDashboardOverview() {
  const [
    kittens,
    availableKittens,
    studs,
    litters,
    activeParents,
    pendingParentApplications,
    selectionApplications,
    pendingSelectionApplications,
    communityPosts,
    comments,
  ] = await prisma.$transaction([
    prisma.kittenProfile.count({ where: { cat: { deleted_at: null } } }),
    prisma.kittenProfile.count({
      where: { cat: { deleted_at: null }, sale_status: "available" },
    }),
    prisma.breedingCatProfile.count({ where: { cat: { deleted_at: null } } }),
    prisma.litter.count({ where: { deleted_at: null } }),
    prisma.parentProfile.count({ where: { status: "active" } }),
    prisma.parentApplication.count({ where: { status: "pending" } }),
    prisma.selectionApplication.count(),
    prisma.selectionApplication.count({ where: { status: "submitted" } }),
    prisma.post.count({ where: { deleted_at: null } }),
    prisma.comment.count({ where: { deleted_at: null } }),
  ]);

  return {
    kittens,
    availableKittens,
    studs,
    litters,
    activeParents,
    pendingParentApplications,
    selectionApplications,
    pendingSelectionApplications,
    communityPosts,
    comments,
  };
}
