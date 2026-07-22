export interface BreedingPlanPairing {
  id: string;
  maleStudId: string;
  femaleStudId: string;
  timeLabel: string;
  expectedColors: string[];
}

export interface BreedingPlanGroup {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  pairings: BreedingPlanPairing[];
}

export interface BreedingPlanContent {
  version: 1;
  eyebrow: string;
  title: string;
  period: string;
  introduction: string;
  groups: BreedingPlanGroup[];
  disclaimer: string;
}

export const BREEDING_PLAN_CONTENT: BreedingPlanContent = {
  version: 1,
  eyebrow: "Breeding Plan",
  title: "繁育计划",
  period: "2026 下半年",
  introduction: "记录星月接下来的繁育安排，也方便家长提前了解感兴趣的血线组合。",
  groups: [
    {
      id: "upcoming-litters",
      eyebrow: "Upcoming Litters",
      title: "近期窝次",
      pairings: [
        {
          id: "chonglou-yunmu-2026-07",
          maleStudId: "chonglou",
          femaleStudId: "yunmu",
          timeLabel: "预产期 7.24–7.26",
          expectedColors: [],
        },
        {
          id: "tianhe-xiaoxiaxian-2026-09",
          maleStudId: "tianhe",
          femaleStudId: "xiaoxiaxian",
          timeLabel: "预产期 9.4–9.6",
          expectedColors: [],
        },
        {
          id: "chonglou-xiongmao-recent",
          maleStudId: "chonglou",
          femaleStudId: "xiongmao",
          timeLabel: "近期",
          expectedColors: [],
        },
        {
          id: "shulongyin-niaotuan-recent",
          maleStudId: "shulongyin",
          femaleStudId: "niaotuan",
          timeLabel: "近期",
          expectedColors: [],
        },
      ],
    },
    {
      id: "later-this-year",
      eyebrow: "Later This Year",
      title: "8–12 月计划",
      pairings: [
        {
          id: "tianhe-zhaoyue-2026-h2",
          maleStudId: "tianhe",
          femaleStudId: "zhaoyue",
          timeLabel: "预计 8–12 月",
          expectedColors: [],
        },
        {
          id: "tianhe-manao-2026-h2",
          maleStudId: "tianhe",
          femaleStudId: "manao",
          timeLabel: "预计 8–12 月",
          expectedColors: [],
        },
        {
          id: "tianhe-yunyue-2026-h2",
          maleStudId: "tianhe",
          femaleStudId: "yunyue",
          timeLabel: "预计 8–12 月",
          expectedColors: [],
        },
        {
          id: "tianhe-guihuagao-2026-h2",
          maleStudId: "tianhe",
          femaleStudId: "guihuagao",
          timeLabel: "预计 8–12 月",
          expectedColors: [],
        },
        {
          id: "huqing-luoyiyi-2026-h2",
          maleStudId: "huqing",
          femaleStudId: "luoyiyi",
          timeLabel: "预计 8–12 月",
          expectedColors: [],
        },
        {
          id: "shulongyin-xiaobianmu-2026-h2",
          maleStudId: "shulongyin",
          femaleStudId: "xiaobianmu",
          timeLabel: "预计 8–12 月",
          expectedColors: [],
        },
      ],
    },
  ],
  disclaimer: "具体窝次和预计时间受公猫状态、母猫发情时间影响，以实际情况为准。",
};
