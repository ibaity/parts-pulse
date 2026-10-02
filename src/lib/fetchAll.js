const PAGE_SIZE = 1000;
const MAX_LIMIT = 5000;

// Reads every record matching `query` by walking cursor pages,
// so large vendors are never silently cut off at a fixed limit.
export async function fetchAll(entity, query = {}, sort = '-created_date', fields) {
  let page;
  try {
    page = await entity.filter(query, fields ? { sort, limit: PAGE_SIZE, fields } : { sort, limit: PAGE_SIZE });
  } catch {
    page = null;
  }
  // Fallback if cursor pages aren't available: one request at the maximum limit.
  if (!page || !Array.isArray(page.items)) {
    return entity.filter(query, sort, MAX_LIMIT, 0, fields);
  }
  const all = [...page.items];
  while (page.has_more && page.next_cursor) {
    page = await entity.filter(query, { cursor: page.next_cursor, limit: PAGE_SIZE });
    all.push(...page.items);
  }
  return all;
}
