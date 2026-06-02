const BATCH_SIZE = 1000;

type QueryResult<T> = { data: T[] | null; error: unknown };

/** Fetch all rows from a Supabase query, working around the default 1000-row limit. */
export async function fetchAllPaginated<T>(
  runQuery: (from: number, to: number) => Promise<QueryResult<T>>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await runQuery(from, from + BATCH_SIZE - 1);
    if (error) throw error;
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }

  return all;
}
