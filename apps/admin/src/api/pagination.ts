export async function listAllPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; pagination: { totalPages: number } }>,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await fetchPage(page);
    items.push(...result.items);
    totalPages = result.pagination.totalPages;
    page += 1;
  }

  return items;
}
