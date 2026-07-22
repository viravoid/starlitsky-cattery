export type PhilosophyMilestone = {
  value: string;
  description: string;
};

export type PhilosophyContent = {
  version: 1;
  openingBelief: string;
  growthEffortParagraph: string;
  growthCommunityParagraph: string;
  growthFuturePlanParagraph: string;
  milestones: {
    founder: PhilosophyMilestone;
    yueqi: PhilosophyMilestone;
  };
  stageNewHomeParagraph: string;
  stageClearGoalParagraph: string;
  styleBloodlineParagraph: string;
  styleBeyondLabelsParagraph: string;
  highlightLineOne: string;
  highlightLineTwo: string;
  directionGlobalBreedersParagraph: string;
  directionGoalParagraph: string;
  closingLifeParagraph: string;
  closingCareerParagraph: string;
  closingParentParagraph: string;
  closingAftercareParagraph: string;
};

export const DEFAULT_PHILOSOPHY_CONTENT: PhilosophyContent = {
  version: 1,
  openingBelief:
    "我们的繁育理念是繁育体质好、抵抗力强，乖巧亲人、大方自信的小猫。从小猫出生开始记录到去新家，让家长不会缺席小猫成长的每一个阶段。做一家有温度的猫舍。",
  growthEffortParagraph:
    "这些年我们一直在不断努力，投入更多的精力陪伴小猫，从小进行社会化并记录日常，把主粮从 Halo 换成 NG 和百利高。",
  growthCommunityParagraph:
    "这一切的努力都是有回报的。在小猫日常记录群，我们也认识了很多新朋友，得到了很多家长的支持与信任，也繁育出了很多很满意的小猫。",
  growthFuturePlanParagraph: "今年也会有更多自留和新引进的宝宝加入我们的繁育计划。",
  milestones: {
    founder: {
      value: "05",
      description: "我做繁育的第五年",
    },
    yueqi: {
      value: "07",
      description: "月七做繁育的第七年",
    },
  },
  stageNewHomeParagraph: "我们终于搬进了和小猫共同的新家，我们的人生和猫舍也都迈向了一个新的阶段。",
  stageClearGoalParagraph: "从一开始的迷茫从众，到现在有了清晰的目标。",
  styleBloodlineParagraph:
    "如今我们对缅因猫的血线也有了比较深入的了解，意识到血线与风格的复杂与多样，不再拘泥于「纯美血」「纯欧血」这种划分。",
  styleBeyondLabelsParagraph: "因为缅因从不只有这两种风格。",
  highlightLineOne: "甜美小体、大体、大刷子、毛怪，",
  highlightLineTwo: "都代表不了全部的缅因猫。",
  directionGlobalBreedersParagraph:
    "在世界各地都有出色的缅因繁育人，很多繁育人的小猫都有着自己独特又有魅力的风格。",
  directionGoalParagraph:
    "我们追求的，就是在符合品标的前提下，做好健康筛查，繁育出健康亲人、表情精致甜酷、体格较大、毛量优秀，并有自己独特风格的小猫。",
  closingLifeParagraph:
    "经过多年深耕，我们的生活早已和猫舍深度绑定，很多家长也都成为了我们的朋友。",
  closingCareerParagraph:
    "猫舍早已不只是我们的兴趣爱好，而是我们想要坚持一生的事业。每只小猫都是我们家中的一份子。",
  closingParentParagraph:
    "我们希望以后也能遇到更多三观相符、科养爱猫的小猫家长，互相尊重、互相选择、互相信任，一起把每一只小猫照顾好。",
  closingAftercareParagraph:
    "有任何问题，我们都绝不推诿，认真做好售后，让每个宝宝都能健康长大，和新家长开心生活。",
};

export function clonePhilosophyContent(content: PhilosophyContent = DEFAULT_PHILOSOPHY_CONTENT) {
  return JSON.parse(JSON.stringify(content)) as PhilosophyContent;
}

export function normalizePhilosophyContent(value: unknown): PhilosophyContent {
  if (!value || typeof value !== "object") return clonePhilosophyContent();

  const input = value as Partial<PhilosophyContent>;
  const base = clonePhilosophyContent();

  return {
    version: 1,
    openingBelief: normalizeString(input.openingBelief, base.openingBelief),
    growthEffortParagraph: normalizeString(input.growthEffortParagraph, base.growthEffortParagraph),
    growthCommunityParagraph: normalizeString(
      input.growthCommunityParagraph,
      base.growthCommunityParagraph,
    ),
    growthFuturePlanParagraph: normalizeString(
      input.growthFuturePlanParagraph,
      base.growthFuturePlanParagraph,
    ),
    milestones: {
      founder: normalizeMilestone(input.milestones?.founder, base.milestones.founder),
      yueqi: normalizeMilestone(input.milestones?.yueqi, base.milestones.yueqi),
    },
    stageNewHomeParagraph: normalizeString(input.stageNewHomeParagraph, base.stageNewHomeParagraph),
    stageClearGoalParagraph: normalizeString(
      input.stageClearGoalParagraph,
      base.stageClearGoalParagraph,
    ),
    styleBloodlineParagraph: normalizeString(
      input.styleBloodlineParagraph,
      base.styleBloodlineParagraph,
    ),
    styleBeyondLabelsParagraph: normalizeString(
      input.styleBeyondLabelsParagraph,
      base.styleBeyondLabelsParagraph,
    ),
    highlightLineOne: normalizeString(input.highlightLineOne, base.highlightLineOne),
    highlightLineTwo: normalizeString(input.highlightLineTwo, base.highlightLineTwo),
    directionGlobalBreedersParagraph: normalizeString(
      input.directionGlobalBreedersParagraph,
      base.directionGlobalBreedersParagraph,
    ),
    directionGoalParagraph: normalizeString(
      input.directionGoalParagraph,
      base.directionGoalParagraph,
    ),
    closingLifeParagraph: normalizeString(input.closingLifeParagraph, base.closingLifeParagraph),
    closingCareerParagraph: normalizeString(
      input.closingCareerParagraph,
      base.closingCareerParagraph,
    ),
    closingParentParagraph: normalizeString(
      input.closingParentParagraph,
      base.closingParentParagraph,
    ),
    closingAftercareParagraph: normalizeString(
      input.closingAftercareParagraph,
      base.closingAftercareParagraph,
    ),
  };
}

function normalizeMilestone(value: unknown, fallback: PhilosophyMilestone): PhilosophyMilestone {
  if (!value || typeof value !== "object") return { ...fallback };
  const input = value as Partial<PhilosophyMilestone>;
  return {
    value: normalizeString(input.value, fallback.value).slice(0, 4),
    description: normalizeString(input.description, fallback.description),
  };
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}
