import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';

import GAME_CHAPTERS from '../data/chapters.json';
import { getChapterProgress, getNextPlayableLevel } from '../utils/chapterProgress';
import { getCompletedLevels } from '../utils/storage';
import { useAppTheme } from '../context/ThemeContext';
import { useAudio } from '../context/AudioContext';
import SettingsModal from './SettingsModal';

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const { playTapSound } = useAudio();
  const [completedLevels, setCompletedLevels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isMounted = useRef(false);

  const loadProgress = useCallback(async () => {
    try {
      const completed = await getCompletedLevels();
      if (isMounted.current) setCompletedLevels(completed);
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

  const chapters = getChapterProgress(completedLevels);
  const nextPlayable = getNextPlayableLevel(completedLevels);
  const totalLevelCount = chapters.reduce((sum, chapter) => sum + chapter.levelCount, 0);
  const completedLevelCount = chapters.reduce((sum, chapter) => sum + chapter.completedCount, 0);
  const completedChapterCount = chapters.filter((chapter) => chapter.isComplete).length;
  const allComplete = chapters.length > 0 && chapters.every((chapter) => chapter.isComplete);
  const activeChapterId = nextPlayable?.chapter.id;
  const progressPercent = totalLevelCount > 0
    ? Math.round((completedLevelCount / totalLevelCount) * 100)
    : 0;

  const openNextLevel = () => {
    playTapSound();
    if (nextPlayable?.level) {
      router.push({ pathname: '/game', params: { levelId: nextPlayable.level.id } });
      return;
    }
    if (allComplete && GAME_CHAPTERS[0]) {
      router.push({ pathname: '/game', params: { levelId: chapters[0].chapterLevels[0]?.id } });
      return;
    }
    const firstUnlockedChapter = chapters.find((chapter) => chapter.isUnlocked);
    if (firstUnlockedChapter) {
      router.push({ pathname: '/chapter', params: { chapterId: firstUnlockedChapter.id } });
    }
  };

  const openReplayChapter = () => {
    playTapSound();
    router.push({ pathname: '/chapter', params: { chapterId: GAME_CHAPTERS[0].id } });
  };

  const renderChapter = ({ item: chapter }) => {
    const missingPrerequisite = chapters
      .slice(0, chapter.index)
      .find((previousChapter) => !previousChapter.isComplete);
    const progressText = `${chapter.completedCount}/${chapter.levelCount} Levels Complete`;
    const lockedText = !chapter.isUnlocked && missingPrerequisite
      ? `Complete ${missingPrerequisite.title} to unlock`
      : null;
    const isActive = chapter.id === activeChapterId;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Chapter ${chapter.index + 1}: ${chapter.title}, ${chapter.isUnlocked ? progressText : lockedText}`}
        accessibilityState={{ disabled: !chapter.isUnlocked }}
        disabled={!chapter.isUnlocked}
        onPress={() => {
          playTapSound();
          router.push({ pathname: '/chapter', params: { chapterId: chapter.id } });
        }}
        style={({ pressed }) => [
          styles.chapterCard,
          {
            backgroundColor: chapter.isUnlocked ? colors.card : colors.lockedBg,
            borderColor: isActive ? colors.primary : chapter.isUnlocked ? colors.cardBorder : colors.lockedBorder,
            borderWidth: isActive ? 2 : 1,
            opacity: chapter.isUnlocked ? 1 : 0.68,
          },
          pressed && chapter.isUnlocked && styles.pressed,
        ]}
      >
        <View style={styles.chapterCardText}>
          <View style={styles.chapterNumberRow}>
            <Text style={[styles.chapterNumber, { color: chapter.isUnlocked ? colors.primary : colors.lockedText }]}>
              CHAPTER {String(chapter.index + 1).padStart(2, '0')}
            </Text>
            {isActive ? (
              <Text style={[styles.activeLabel, { color: colors.primary, backgroundColor: colors.palePrimary }]}>
                UP NEXT
              </Text>
            ) : null}
          </View>
          <Text style={[styles.chapterTitle, { color: chapter.isUnlocked ? colors.ink : colors.lockedText }]}>
            {chapter.title}
          </Text>
          <Text style={[styles.chapterStatus, { color: chapter.isUnlocked ? colors.muted : colors.lockedText }]}>
            {progressText}
          </Text>
          {lockedText ? (
            <Text style={[styles.lockedSubtitle, { color: colors.lockedText }]}>{lockedText}</Text>
          ) : chapter.isComplete ? (
            <Text style={[styles.completeSubtitle, { color: colors.primary }]}>Chapter complete</Text>
          ) : chapter.levelCount === 0 ? (
            <Text style={[styles.completeSubtitle, { color: colors.muted }]}>Coming soon</Text>
          ) : null}
        </View>
        {!chapter.isUnlocked ? (
          <Image
            source={require('../../assets/images/lock.png')}
            style={[styles.lockIcon, { tintColor: colors.lockedText }]}
          />
        ) : (
          <Text style={[styles.chapterIndicator, { color: chapter.isComplete ? colors.primary : colors.muted }]}>
            {chapter.isComplete ? '✓' : '›'}
          </Text>
        )}
      </Pressable>
    );
  };

  const ctaTitle = allComplete
    ? 'Play Again'
    : nextPlayable
      ? `Continue Chapter ${String(nextPlayable.chapter.index + 1).padStart(2, '0')}`
      : 'Choose a Chapter';
  const ctaSubtitle = allComplete
    ? 'Replay your first puzzle'
    : nextPlayable
      ? `Next up: ${nextPlayable.level.name}`
      : 'Your next puzzle is waiting';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <FlatList
        data={chapters}
        keyExtractor={(chapter) => chapter.id}
        renderItem={renderChapter}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.headerTopBar}>
                <Text style={[styles.title, { color: colors.ink }]}>Tree Flipper</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open settings"
                  onPress={() => setIsSettingsOpen(true)}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.settingsButton,
                    { backgroundColor: colors.palePrimary },
                    pressed && styles.pressed,
                  ]}
                >
                  <Image
                    source={require('../../assets/images/settings-gear.png')}
                    style={[styles.settingsImage, { tintColor: colors.primary }]}
                  />
                </Pressable>
              </View>
              <Text style={[styles.subtitle, { color: colors.muted }]}>
                Flip the branches. Find the pattern. Keep climbing.
              </Text>
            </View>

            {allComplete ? (
              <View style={[styles.celebrationBanner, { backgroundColor: colors.palePrimary, borderColor: colors.primary }]}>
                <Text style={styles.celebrationEmoji}>🎉</Text>
                <View style={styles.celebrationTextWrap}>
                  <Text style={[styles.celebrationTitle, { color: colors.primary }]}>All Chapters Conquered!</Text>
                  <Text style={[styles.celebrationSubtitle, { color: colors.ink }]}>Every puzzle is complete. Amazing work.</Text>
                </View>
              </View>
            ) : null}

            <View style={[styles.progressPanel, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.progressHeading}>
                <Text style={[styles.progressLabel, { color: colors.muted }]}>TOTAL PROGRESS</Text>
                <Text style={[styles.progressPercent, { color: colors.primary }]}>{progressPercent}%</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.lockedBg }]}>
                <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: colors.primary }]} />
              </View>
              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Text style={[styles.metricValue, { color: colors.ink }]}>{completedLevelCount}/{totalLevelCount}</Text>
                  <Text style={[styles.metricLabel, { color: colors.muted }]}>Levels</Text>
                </View>
                <View style={[styles.metricDivider, { backgroundColor: colors.cardBorder }]} />
                <View style={styles.metric}>
                  <Text style={[styles.metricValue, { color: colors.ink }]}>{completedChapterCount}/{chapters.length}</Text>
                  <Text style={[styles.metricLabel, { color: colors.muted }]}>Chapters Completed</Text>
                </View>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${ctaTitle}. ${ctaSubtitle}`}
              onPress={openNextLevel}
              style={({ pressed }) => [
                styles.primaryCta,
                { backgroundColor: colors.primary },
                pressed && styles.ctaPressed,
              ]}
            >
              <View style={styles.ctaTextWrap}>
                <Text style={styles.ctaEyebrow}>{allComplete ? 'READY FOR ANOTHER ROUND?' : 'PICK UP WHERE YOU LEFT OFF'}</Text>
                <Text style={styles.ctaTitle}>{ctaTitle}</Text>
                <Text style={styles.ctaSubtitle}>{ctaSubtitle}</Text>
              </View>
              <Text style={styles.ctaArrow}>›</Text>
            </Pressable>

            <Text style={[styles.sectionTitle, { color: colors.ink }]}>Your Chapters</Text>
          </View>
        }
        ListFooterComponent={
          <View>
            {allComplete ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Replay a chapter"
                onPress={openReplayChapter}
                style={({ pressed }) => [
                  styles.replayCard,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  pressed && styles.pressed,
                ]}
              >
                <View>
                  <Text style={[styles.replayTitle, { color: colors.ink }]}>Replay a Chapter</Text>
                  <Text style={[styles.replaySubtitle, { color: colors.muted }]}>Visit any chapter and play its levels again.</Text>
                </View>
                <Text style={[styles.replayArrow, { color: colors.primary }]}>›</Text>
              </Pressable>
            ) : null}
            <View style={styles.footer} />
          </View>
        }
      />
      {isLoading ? (
        <View style={[styles.loadingOverlay, { backgroundColor: `${colors.background}AA` }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
      <SettingsModal
        visible={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onProgressReset={() => { void loadProgress(); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 26 },
  header: { paddingTop: 8, paddingBottom: 14 },
  headerTopBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 42, fontWeight: '800' },
  settingsButton: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  settingsImage: { height: 24, resizeMode: 'contain', width: 24 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  celebrationBanner: { alignItems: 'center', borderRadius: 15, borderWidth: 1, flexDirection: 'row', marginBottom: 12, padding: 14 },
  celebrationEmoji: { fontSize: 25, marginRight: 12 },
  celebrationTextWrap: { flex: 1 },
  celebrationTitle: { fontSize: 16, fontWeight: '800' },
  celebrationSubtitle: { fontSize: 12, marginTop: 2 },
  progressPanel: { borderRadius: 16, borderWidth: 1, marginBottom: 12, padding: 14 },
  progressHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  progressPercent: { fontSize: 14, fontWeight: '800' },
  progressTrack: { borderRadius: 5, height: 7, marginTop: 9, overflow: 'hidden' },
  progressFill: { borderRadius: 5, height: '100%' },
  metricsRow: { alignItems: 'center', flexDirection: 'row', marginTop: 12 },
  metric: { flex: 1 },
  metricValue: { fontSize: 17, fontWeight: '800' },
  metricLabel: { fontSize: 11, marginTop: 1 },
  metricDivider: { height: 30, marginHorizontal: 12, width: 1 },
  primaryCta: { alignItems: 'center', borderRadius: 17, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22, minHeight: 106, paddingHorizontal: 18, paddingVertical: 16 },
  ctaTextWrap: { flex: 1, paddingRight: 12 },
  ctaEyebrow: { color: '#FFFFFFCC', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  ctaTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 5 },
  ctaSubtitle: { color: '#FFFFFFE8', fontSize: 12, marginTop: 3 },
  ctaArrow: { color: '#FFFFFF', fontSize: 34, fontWeight: '400' },
  ctaPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  sectionTitle: { fontSize: 19, fontWeight: '800', marginBottom: 10 },
  chapterCard: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, minHeight: 94, paddingHorizontal: 15, paddingVertical: 12 },
  chapterCardText: { flex: 1, paddingRight: 12 },
  chapterNumberRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  chapterNumber: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  activeLabel: { borderRadius: 8, fontSize: 8, fontWeight: '800', letterSpacing: 0.5, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3 },
  chapterTitle: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  chapterStatus: { fontSize: 12, marginTop: 4 },
  lockedSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  completeSubtitle: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  chapterIndicator: { fontSize: 25, fontWeight: '700', paddingHorizontal: 4 },
  lockIcon: { height: 20, resizeMode: 'contain', width: 20 },
  replayCard: { alignItems: 'center', borderRadius: 15, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 15, paddingVertical: 14 },
  replayTitle: { fontSize: 15, fontWeight: '800' },
  replaySubtitle: { fontSize: 12, marginTop: 3 },
  replayArrow: { fontSize: 24, fontWeight: '700', paddingLeft: 10 },
  pressed: { opacity: 0.78 },
  footer: { height: 20 },
  loadingOverlay: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
});
