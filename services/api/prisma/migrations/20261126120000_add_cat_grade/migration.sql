-- Existing cats keep NULL until an administrator assigns a grade.
ALTER TABLE "cats" ADD COLUMN "grade" TEXT CHECK ("grade" IN ('pet', 'show'));
