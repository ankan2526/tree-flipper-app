import AsyncStorage from '@react-native-async-storage/async-storage';

const COMPLETED_LEVELS_KEY = '@tree-flipper/completed-levels';
const BEST_SCORES_KEY = '@tree-flipper/best-scores';
const THEME_KEY = '@tree-flipper/theme';
const SOUND_SETTINGS_KEY = '@tree-flipper/sound-settings';

export async function getCompletedLevels() {
  const storedValue = await AsyncStorage.getItem(COMPLETED_LEVELS_KEY);

  if (storedValue === null) {
    return [];
  }

  const completedLevels = JSON.parse(storedValue);
  if (
    !Array.isArray(completedLevels) ||
    !completedLevels.every((levelId) => typeof levelId === 'string')
  ) {
    throw new Error('Saved completed levels have an invalid format.');
  }

  return completedLevels;
}

export async function saveCompletedLevel(levelId) {
  if (typeof levelId !== 'string' || levelId.length === 0) {
    throw new TypeError('levelId must be a non-empty string.');
  }

  const completedLevels = await getCompletedLevels();
  if (completedLevels.includes(levelId)) {
    return completedLevels;
  }

  const updatedLevels = [...completedLevels, levelId];
  await AsyncStorage.setItem(COMPLETED_LEVELS_KEY, JSON.stringify(updatedLevels));
  return updatedLevels;
}

export async function getBestScores() {
  const storedValue = await AsyncStorage.getItem(BEST_SCORES_KEY);
  if (storedValue === null) {
    return {};
  }
  try {
    const scores = JSON.parse(storedValue);
    if (typeof scores === 'object' && scores !== null && !Array.isArray(scores)) {
      return scores;
    }
    return {};
  } catch {
    return {};
  }
}

export async function saveBestScore(levelId, moves) {
  if (typeof levelId !== 'string' || typeof moves !== 'number') {
    return { isNewBest: false, scores: {} };
  }
  const currentScores = await getBestScores();
  const currentBest = currentScores[levelId];
  if (currentBest === undefined || moves < currentBest) {
    const updated = {
      ...currentScores,
      [levelId]: moves,
    };
    await AsyncStorage.setItem(BEST_SCORES_KEY, JSON.stringify(updated));
    return { isNewBest: true, scores: updated };
  }
  return { isNewBest: false, scores: currentScores };
}

export async function getThemeSetting() {
  const val = await AsyncStorage.getItem(THEME_KEY);
  if (val === 'forest' || val === 'dark' || val === 'ocean' || val === 'sunset') {
    return val;
  }
  return 'forest';
}

export async function saveThemeSetting(themeKey) {
  await AsyncStorage.setItem(THEME_KEY, themeKey);
  return themeKey;
}

export async function resetAllProgress() {
  await AsyncStorage.multiRemove([COMPLETED_LEVELS_KEY, BEST_SCORES_KEY]);
}

export async function getSoundSettings() {
  const val = await AsyncStorage.getItem(SOUND_SETTINGS_KEY);
  if (!val) {
    return { sfxEnabled: true, musicEnabled: true, hapticsEnabled: true };
  }
  try {
    const parsed = JSON.parse(val);
    return {
      sfxEnabled: parsed.sfxEnabled ?? true,
      musicEnabled: parsed.musicEnabled ?? true,
      hapticsEnabled: parsed.hapticsEnabled ?? true,
    };
  } catch {
    return { sfxEnabled: true, musicEnabled: true, hapticsEnabled: true };
  }
}

export async function saveSoundSettings(settings) {
  await AsyncStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(settings));
  return settings;
}
