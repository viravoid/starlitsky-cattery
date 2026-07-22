export type ContactAccount = {
  id: string;
  label: string;
  value: string;
};

export type ContactContent = {
  version: 1;
  introduction: string;
  accounts: ContactAccount[];
  footerNotice: string;
};

export const DEFAULT_CONTACT_CONTENT: ContactContent = {
  version: 1,
  introduction: "点击即可复制账号，欢迎来聊聊猫、看看小猫日常。",
  accounts: [
    {
      id: "contact-wechat",
      label: "微信号",
      value: "xingyuemianyinmao",
    },
    {
      id: "contact-xiaohongshu",
      label: "小红书",
      value: "StarlitSky星月缅因猫舍",
    },
    {
      id: "contact-weibo",
      label: "微博",
      value: "星月缅因猫舍",
    },
    {
      id: "contact-douyin",
      label: "抖音",
      value: "星月家的猫",
    },
    {
      id: "contact-kitten-daily",
      label: "小猫日常号",
      value: "月七的小猫存档",
    },
  ],
  footerNotice: "咨询前建议先读完接猫流程、填写选猫问卷，方便我们更好地了解你的需求。",
};

export function cloneContactContent(content: ContactContent = DEFAULT_CONTACT_CONTENT) {
  return JSON.parse(JSON.stringify(content)) as ContactContent;
}

export function normalizeContactContent(value: unknown): ContactContent {
  if (!value || typeof value !== "object") return cloneContactContent();

  const input = value as Partial<ContactContent>;
  const base = cloneContactContent();

  return {
    version: 1,
    introduction: typeof input.introduction === "string" ? input.introduction : base.introduction,
    accounts: normalizeAccounts(input.accounts, base.accounts),
    footerNotice: typeof input.footerNotice === "string" ? input.footerNotice : base.footerNotice,
  };
}

export function findWechatAccount(content: ContactContent): ContactAccount | null {
  const directWechat = content.accounts.find(
    (account) => account.id === "contact-wechat" && Boolean(account.value.trim()),
  );
  if (directWechat) return directWechat;

  return (
    content.accounts.find(
      (account) => account.label.trim().includes("微信") && Boolean(account.value.trim()),
    ) ?? null
  );
}

function normalizeAccounts(value: unknown, fallback: ContactAccount[]): ContactAccount[] {
  if (!Array.isArray(value)) return fallback;

  const reservedIds = collectCanonicalIds(value);
  const usedIds = new Set<string>();
  return value.map((item, index) => {
    const input = item && typeof item === "object" ? (item as Partial<ContactAccount>) : {};
    return {
      id: normalizeItemId(input.id, index, usedIds, reservedIds),
      label: typeof input.label === "string" ? input.label : "",
      value: typeof input.value === "string" ? input.value : "",
    };
  });
}

function collectCanonicalIds(items: unknown[]) {
  const ids = new Set<string>();
  items.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const id = (item as { id?: unknown }).id;
    if (typeof id !== "string") return;
    const canonicalId = id.trim();
    if (canonicalId) ids.add(canonicalId);
  });
  return ids;
}

function normalizeItemId(
  value: unknown,
  index: number,
  usedIds: Set<string>,
  reservedIds: Set<string>,
) {
  const canonicalId = typeof value === "string" ? value.trim() : "";
  if (canonicalId && !usedIds.has(canonicalId)) {
    usedIds.add(canonicalId);
    return canonicalId;
  }

  const baseId = `contact-account-${index + 1}`;
  let candidate = baseId;
  let suffix = 2;
  while (usedIds.has(candidate) || reservedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}
