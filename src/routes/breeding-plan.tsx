import { createFileRoute } from "@tanstack/react-router";
import { BreedingPlanView } from "@/components/mobile/BreedingPlanView";
import { BREEDING_PLAN_CONTENT } from "@/lib/breeding-plan-content";
import { STUDS } from "@/lib/cattery-data";

export const Route = createFileRoute("/breeding-plan")({
  head: () => ({
    meta: [
      { title: "繁育计划 — 星月缅因猫舍" },
      {
        name: "description",
        content:
          "星月缅因猫舍 2026 年下半年繁育组合、预计时间和预计花色记录，具体安排以实际情况为准。",
      },
    ],
  }),
  component: BreedingPlan,
});

function BreedingPlan() {
  return <BreedingPlanView content={BREEDING_PLAN_CONTENT} studs={STUDS} />;
}
