export function createStableId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function moveById<T extends { id: string }>(items: T[], id: string, direction: -1 | 1) {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  return moveValueTo(items, items[index], items[target]);
}

export function moveToId<T extends { id: string }>(items: T[], id: string, targetId: string) {
  const item = items.find((current) => current.id === id);
  const target = items.find((current) => current.id === targetId);
  if (!item || !target || item.id === target.id) return items;
  return moveValueTo(items, item, target);
}

function moveValueTo<T>(items: T[], item: T, target: T) {
  const from = items.indexOf(item);
  const to = items.indexOf(target);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
