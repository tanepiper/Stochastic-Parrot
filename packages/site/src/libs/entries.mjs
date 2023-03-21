/**
 * Creates a loader manager for all entries.
 */
export function createEntriesLoader() {
  let entries = [];

  /**
   * @param {number=} start
   * @param {number=} end
   * @param {string=} sortBy
   * @returns {Promise<object[]>}
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

  async function getDallEImageFilenames() {
    const imageFiles = await import.meta.glob('../../public/dall-e/*.webp', {
      eager: true,
    });
    return Object.keys(imageFiles)
      .map((e) => e.replace('../../public/dall-e/', ''))
      .sort((a, b) => (a > b ? -1 : 1));
  }

  function getEntries() {
    return entries;
  }

  return { loadEntries, getEntries, getDallEImageFilenames };
}
