import GAME_CHAPTERS from '../data/chapters.json';
import { GAME_LEVELS } from '../data/levels';

export function getChapterProgress(completedLevels = []) {
  return GAME_CHAPTERS.map((chapter, index) => {
    const chapterLevels = GAME_LEVELS.filter(
      (level) => (level.chapterId || GAME_CHAPTERS[0].id) === chapter.id,
    );
    const completedCount = chapterLevels.filter((level) => completedLevels.includes(level.id)).length;
    const isComplete = chapterLevels.length > 0 && completedCount === chapterLevels.length;
    const isUnlocked = index === 0 || GAME_CHAPTERS.slice(0, index).every((previousChapter) => {
      const previousLevels = GAME_LEVELS.filter(
        (level) => (level.chapterId || GAME_CHAPTERS[0].id) === previousChapter.id,
      );
      return previousLevels.length > 0 && previousLevels.every((level) => completedLevels.includes(level.id));
    });

    return {
      ...chapter,
      index,
      chapterLevels,
      completedCount,
      isComplete,
      isUnlocked,
      levelCount: chapterLevels.length,
    };
  });
}

export function getNextPlayableLevel(completedLevels = []) {
  const chapters = getChapterProgress(completedLevels);
  for (const chapter of chapters) {
    if (!chapter.isUnlocked) continue;
    for (let index = 0; index < chapter.chapterLevels.length; index += 1) {
      const level = chapter.chapterLevels[index];
      const previousLevel = chapter.chapterLevels[index - 1];
      const isUnlocked = index === 0 || completedLevels.includes(previousLevel.id);
      if (isUnlocked && !completedLevels.includes(level.id)) {
        return { chapter, level };
      }
    }
  }
  return null;
}
