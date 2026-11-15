let cachedCompletedLevels = null;

export function getCachedCompletedLevels() {
  return cachedCompletedLevels ? [...cachedCompletedLevels] : null;
}

export function setCachedCompletedLevels(levelIds) {
  cachedCompletedLevels = [...levelIds];
}
