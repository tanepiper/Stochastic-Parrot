
/**
 * Creates a loader manager for all entries.
 */
export function createEntriesLoader() {

    let entries = []

    /**
     * @param {number=} start
     * @param {number=} end
     * @param {string=} sortBy
     * @returns {Promise<[]>}
     */
  async function loadEntries(start = 0, end = 0, sortBy = 'created') {
    const entryFiles = await import.meta.glob('../../public/entries/*.json', {
      eager: true,
    });
    let sorted = Object.values(entryFiles ?? {})
      .map((e) => e.default)
      .sort((a, b) => (a[sortBy] > b[sortBy] ? -1 : 1));
      entries = [...sorted];

    if (end > 0) {
        sorted = sorted.slice(start, end);
    }
    return sorted;
  }

  function getEntries() {
      return entries;
  }

  return { loadEntries, getEntries };
}
