import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import TreeRenderer, { getTreeNaturalWidth } from '../components/TreeRenderer';
import { GAME_LEVELS } from '../data/levels';
import GAME_CHAPTERS from '../data/chapters.json';
import { getChapterProgress } from '../utils/chapterProgress';
import { getCachedCompletedLevels, setCachedCompletedLevels } from '../utils/progressCache';
import { getBestScores, getCompletedLevels } from '../utils/storage';
import { useAppTheme } from '../context/ThemeContext';
import { useAudio } from '../context/AudioContext';

const PREVIEW_SCALE = 0.55;
const CARD_PADDING = 12;
const HORIZONTAL_PADDING = 18;
const GRID_GAP = 12;
const FALLBACK_WIDTH = 375;

function getChapterRule(chapter) {
  if (chapter.moveLimitMode === 'per-level') {
    return 'Each level has a move limit. Match the target tree before your moves run out.';
  }
  if (chapter.moveLimitMode === 'node-locks') {
    return 'Node countdowns decrease after each move. At zero, a node cannot be tapped directly, but ancestor flips can still change its color.';
  }
  return 'Flip nodes or branches until your tree matches the target tree.';
}

export default function ChapterScreen({ chapterId }) {
  const { colors } = useAppTheme();
  const { playTapSound } = useAudio();
  const { width: windowWidth } = useWindowDimensions();
  const [completedLevels, setCompletedLevels] = useState(() => getCachedCompletedLevels() || []);
  const [bestScores, setBestScores] = useState({});
  const [isLoading, setIsLoading] = useState(() => getCachedCompletedLevels() === null);
  const isMounted = useRef(false);

  const chapter = GAME_CHAPTERS.find((entry) => entry.id === chapterId);
  const allChapterProgress = getChapterProgress(completedLevels);
  const chapterProgress = allChapterProgress.find((entry) => entry.id === chapterId);
  const effectiveWidth = windowWidth || FALLBACK_WIDTH;
  const halfCardWidth = (effectiveWidth - HORIZONTAL_PADDING * 2 - GRID_GAP) / 2;
  const halfCardInnerWidth = Math.max(0, halfCardWidth - CARD_PADDING * 2);

  const loadProgress = useCallback(async () => {
    try {
      const [completed, scores] = await Promise.all([getCompletedLevels(), getBestScores()]);
      if (isMounted.current) {
        setCachedCompletedLevels(completed);
        setCompletedLevels(completed);
        setBestScores(scores || {});
      }
    } catch (error) {
      if (isMounted.current) {
        const message = error instanceof Error ? error.message : 'Unknown storage error.';
        Alert.alert('Progress unavailable', `Could not load saved progress. ${message}`);
      }
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      void loadProgress();
      return () => {
        isMounted.current = false;
      };
    }, [loadProgress]),
  );

  const levels = useMemo(() => {
    if (!chapter) return [];
    return GAME_LEVELS
      .map((level) => ({ ...level }))
      .filter((level) => (level.chapterId || GAME_CHAPTERS[0].id) === chapter.id)
      .map((level, chapterLevelIndex, chapterLevels) => ({
        ...level,
        chapterLevelIndex,
        isUnlocked: chapterProgress?.isUnlocked === true && (
          chapterLevelIndex === 0 || completedLevels.includes(chapterLevels[chapterLevelIndex - 1].id)
        ),
      }));
  }, [chapter, chapterProgress?.isUnlocked, completedLevels]);

  const rows = useMemo(() => {
    const chapterRows = [];
    let pendingHalfItem = null;
    levels.forEach((level) => {
      const scaledWidth = getTreeNaturalWidth(level.tree) * PREVIEW_SCALE;
      const item = { ...level, isFullWidth: scaledWidth > halfCardInnerWidth };
      if (item.isFullWidth) {
        if (pendingHalfItem) {
          chapterRows.push({ id: `row-${pendingHalfItem.id}`, items: [pendingHalfItem] });
          pendingHalfItem = null;
        }
        chapterRows.push({ id: `row-${item.id}`, items: [item] });
      } else if (pendingHalfItem) {
        chapterRows.push({ id: `row-${pendingHalfItem.id}-${item.id}`, items: [pendingHalfItem, item] });
        pendingHalfItem = null;
      } else {
        pendingHalfItem = item;
      }
    });
    if (pendingHalfItem) chapterRows.push({ id: `row-${pendingHalfItem.id}`, items: [pendingHalfItem] });
    return chapterRows;
  }, [halfCardInnerWidth, levels]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  const renderLevel = (level, isSingleInRow) => {
    const isComplete = completedLevels.includes(level.id);
    const bestScore = bestScores[level.id];
    return (
      <Pressable
        key={level.id}
        accessibilityRole="button"
        accessibilityLabel={`${level.name}${!level.isUnlocked ? ', locked' : isComplete ? ', completed' : ''}`}
        accessibilityState={{ disabled: !level.isUnlocked }}
        disabled={!level.isUnlocked}
        onPress={() => {
          if (!level.isUnlocked) return;
          playTapSound();
          router.push({ pathname: '/game', params: { levelId: level.id } });
        }}
        style={({ pressed }) => [
          styles.levelCard,
          isSingleInRow ? styles.fullWidthCard : styles.halfWidthCard,
          {
            backgroundColor: level.isUnlocked ? colors.card : colors.lockedBg,
            borderColor: !level.isUnlocked ? colors.lockedBorder : isComplete ? colors.primary : colors.cardBorder,
            borderWidth: isComplete ? 2 : 1,
            opacity: level.isUnlocked ? 1 : 0.75,
          },
          pressed && level.isUnlocked && styles.pressedCard,
        ]}
      >
        <View style={styles.levelHeader}>
          <Text style={[styles.levelNumber, { color: level.isUnlocked ? colors.muted : colors.lockedText }]}>
            LEVEL {String(level.chapterLevelIndex + 1).padStart(2, '0')}
          </Text>
          {isComplete ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>✓</Text>
            </View>
          ) : !level.isUnlocked ? (
            <View style={[styles.lockBadge, { backgroundColor: colors.lockedBorder }]}>
              <Image
                source={require('../../assets/images/lock.png')}
                style={[styles.lockIcon, { tintColor: colors.lockedText }]}
              />
            </View>
          ) : null}
        </View>
        <Text
          style={[styles.levelName, { color: level.isUnlocked ? colors.ink : colors.lockedText }]}
          numberOfLines={1}
        >
          {level.name}
        </Text>
        {level.moveLimit ? (
          <Text style={[styles.moveLimitLabel, { color: colors.accent }]}>MOVE LIMIT: {level.moveLimit}</Text>
        ) : null}
        <View style={styles.treePreviewWrapper}>
          <TreeRenderer tree={level.tree} scale={PREVIEW_SCALE} />
        </View>
        <View style={styles.levelBottom}>
          {bestScore !== undefined ? (
            <Text style={[styles.bestScoreText, { color: colors.accent }]}>
              ★ Best: {bestScore} {bestScore === 1 ? 'move' : 'moves'}
            </Text>
          ) : null}
          <Text style={[styles.levelAction, { color: level.isUnlocked ? colors.primary : colors.lockedText }]}>
            {!level.isUnlocked ? 'Locked' : isComplete ? 'Play again →' : 'Tap to play →'}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderRow = ({ item: row }) => {
    const isSingle = row.items.length === 1;
    return (
      <View style={styles.levelRow}>
        {row.items.map((level) => renderLevel(level, isSingle))}
      </View>
    );
  };

  if (!chapter || !chapterProgress) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.centeredMessage}>
          <Text style={[styles.screenTitle, { color: colors.ink }]}>Chapter not found</Text>
          <Pressable onPress={handleBack} style={[styles.backButton, { backgroundColor: colors.palePrimary }]}>
            <Text style={[styles.backText, { color: colors.primary }]}>Back to chapters</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!chapterProgress.isUnlocked) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.centeredMessage}>
          <Text style={[styles.screenTitle, { color: colors.ink }]}>Chapter locked</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Complete all previous chapters to unlock this one.</Text>
          <Pressable onPress={handleBack} style={[styles.backButton, { backgroundColor: colors.palePrimary }]}>
            <Text style={[styles.backText, { color: colors.primary }]}>Back to chapters</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        renderItem={renderRow}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to chapters"
              onPress={handleBack}
              style={styles.backButtonPlain}
            >
              <Text style={[styles.backText, { color: colors.primary }]}>‹  Chapters</Text>
            </Pressable>
            <Text style={[styles.chapterNumber, { color: colors.primary }]}>CHAPTER {String(chapterProgress.index + 1).padStart(2, '0')}</Text>
            <Text style={[styles.screenTitle, { color: colors.ink }]}>{chapter.title}</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>{chapter.description}</Text>
            <View style={[styles.rulesCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.rulesTitle, { color: colors.primary }]}>CHAPTER RULES</Text>
              <Text style={[styles.rulesText, { color: colors.ink }]}>{getChapterRule(chapter)}</Text>
            </View>
            <View style={styles.levelsHeading}>
              <Text style={[styles.levelsTitle, { color: colors.ink }]}>Levels</Text>
              <Text style={[styles.progress, { color: colors.muted }]}>
                {chapterProgress.completedCount} / {chapterProgress.levelCount} complete
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.emptyMessage, { color: colors.muted }]}>Levels are coming soon.</Text>
        }
        ListFooterComponent={<View style={styles.footer} />}
      />
      {isLoading ? (
        <View style={[styles.loadingOverlay, { backgroundColor: `${colors.background}AA` }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: HORIZONTAL_PADDING, paddingTop: 10, paddingBottom: 24 },
  backButtonPlain: { alignSelf: 'flex-start', justifyContent: 'center', marginBottom: 20, minHeight: 44, paddingHorizontal: 6 },
  backButton: { alignItems: 'center', borderRadius: 12, marginTop: 20, paddingHorizontal: 16, paddingVertical: 11 },
  backText: { fontSize: 15, fontWeight: '700' },
  chapterNumber: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  screenTitle: { fontSize: 30, fontWeight: '800', marginTop: 5 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 5 },
  rulesCard: { borderRadius: 16, borderWidth: 1, marginTop: 18, padding: 16 },
  rulesTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  rulesText: { fontSize: 14, lineHeight: 21, marginTop: 7 },
  levelsHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, marginTop: 22 },
  levelsTitle: { fontSize: 20, fontWeight: '800' },
  progress: { fontSize: 12, fontWeight: '700' },
  levelRow: { flexDirection: 'row', gap: GRID_GAP, justifyContent: 'space-between', marginBottom: 12 },
  levelCard: { borderRadius: 18, justifyContent: 'space-between', minHeight: 215, overflow: 'hidden', padding: CARD_PADDING },
  halfWidthCard: { flex: 1 },
  fullWidthCard: { width: '100%' },
  pressedCard: { opacity: 0.8 },
  levelHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  levelNumber: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  badge: { alignItems: 'center', borderRadius: 11, height: 22, justifyContent: 'center', width: 22 },
  badgeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  lockBadge: { alignItems: 'center', borderRadius: 11, height: 22, justifyContent: 'center', width: 22 },
  lockIcon: { height: 14, resizeMode: 'contain', width: 14 },
  levelName: { fontSize: 16, fontWeight: '700', marginTop: 4, marginBottom: 4 },
  moveLimitLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, marginTop: 4 },
  treePreviewWrapper: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4, width: '100%' },
  levelBottom: { marginTop: 'auto', paddingTop: 8 },
  bestScoreText: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  levelAction: { fontSize: 12, fontWeight: '700' },
  emptyMessage: { fontSize: 14, paddingVertical: 22, textAlign: 'center' },
  footer: { height: 20 },
  centeredMessage: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  loadingOverlay: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
});
