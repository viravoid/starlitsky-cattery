export const FIXED_PAGE_DEFINITIONS = [
  { slug: "home", title: "首页" },
  { slug: "about", title: "猫舍介绍" },
  { slug: "philosophy", title: "繁育理念" },
  { slug: "environment", title: "猫舍环境" },
  { slug: "feeding", title: "喂养体系" },
  { slug: "process", title: "价格与接猫流程" },
  { slug: "aftercare", title: "售后保障" },
  { slug: "contact", title: "联系方式" },
  { slug: "questionnaire", title: "选猫问卷" },
  { slug: "breeding-plan", title: "繁育计划" },
];

export const FIXED_PAGE_SLUGS = new Set(FIXED_PAGE_DEFINITIONS.map((page) => page.slug));
