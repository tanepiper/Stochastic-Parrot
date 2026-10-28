/**
 * Prefixes a root-relative path with the configured Astro `base`,
 * so links work when the site is served from a sub-path (e.g. GitHub Pages).
 * @param {string} path
 * @returns {string}
 */
export const withBase = (path) =>
  `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`;
