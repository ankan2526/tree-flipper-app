import { useCallback, useRef, useState } from 'react';
import {
  Modal,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';

import TreeRenderer from '../components/TreeRenderer';
import { GAME_LEVELS } from '../data/levels';
import GAME_CHAPTERS from '../data/chapters.json';
import {
  checkWinCondition,
  flipSingleNode,
  flipSubtree,
} from '../utils/gameLogic';
import { saveBestScore, saveCompletedLevel } from '../utils/storage';
import { useAppTheme } from '../context/ThemeContext';
import { useAudio } from '../context/AudioContext';

const EMPTY_NODE_LOCKS = Object.freeze({});

function createAllRedTree(node) {
  return {
    ...node,
    targetColor: 'red',
    children: (node.children || []).map(createAllRedTree),
  };
}

export default function GameScreen({ levelId }) {
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const {
    playFlipSound,
    playSpecialSound,
    playVictorySound,
    playFailSound,
    playTapSound,
  } = useAudio();
  const level = GAME_LEVELS.find((item) => item.id === levelId);
  const chapter = level
    ? GAME_CHAPTERS.find(
        (item) => item.id === (level.chapterId || GAME_CHAPTERS[0].id),
      )
    : null;
  const moveLimit = ['per-level', 'node-locks'].includes(chapter?.moveLimitMode)
    ? level?.moveLimit
    : null;
  const nodeLocks = chapter?.moveLimitMode === 'node-locks'
    ? level?.nodeLocks || EMPTY_NODE_LOCKS
    : EMPTY_NODE_LOCKS;
  const [currentTree, setCurrentTree] = useState(() =>
    level ? createAllRedTree(level.tree) : null,
  );
  const [targetTree] = useState(() => level?.tree ?? null);
  const [specialMoves, setSpecialMoves] = useState(3);
  const [isSpecialMoveActive, setIsSpecialMoveActive] = useState(false);
  const [isRestartConfirmVisible, setIsRestartConfirmVisible] = useState(false);
  const [isSpecialInfoVisible, setIsSpecialInfoVisible] = useState(false);
  const [specialInfoAnchor, setSpecialInfoAnchor] = useState(null);
  const specialInfoLinkRef = useRef(null);
  const [moveCount, setMoveCount] = useState(0);
  const [lockedNodeInfo, setLockedNodeInfo] = useState(null);
  const lockedNodeIds = Object.entries(nodeLocks)
    .filter(([, lockAfterMoves]) => moveCount >= lockAfterMoves)
    .map(([nodeId]) => nodeId);
  const [isCompletionVisible, setIsCompletionVisible] = useState(false);
  const [isChapterCompletionVisible, setIsChapterCompletionVisible] = useState(false);
  const [isOutOfMovesVisible, setIsOutOfMovesVisible] = useState(false);
  const [completionSaveError, setCompletionSaveError] = useState(null);
  const [isNewBestScore, setIsNewBestScore] = useState(false);
  const hasWon = useRef(false);
  const hasLost = useRef(false);
  const levelIndex = GAME_LEVELS.findIndex((item) => item.id === levelId);
  const chapterIndex = chapter ? GAME_CHAPTERS.indexOf(chapter) : -1;
  const nextChapter = chapterIndex >= 0 ? GAME_CHAPTERS[chapterIndex + 1] : null;
  const chapterLevels = GAME_LEVELS.filter(
    (item) => (item.chapterId || GAME_CHAPTERS[0].id) === chapter?.id,
  );
  const chapterLevelIndex = chapterLevels.findIndex((item) => item.id === levelId);
  const isChapterFinalLevel =
    chapterLevelIndex >= 0 && chapterLevelIndex === chapterLevels.length - 1;
  const nextLevel = isChapterFinalLevel
    ? GAME_LEVELS.find(
        (item) => (item.chapterId || GAME_CHAPTERS[0].id) === nextChapter?.id,
      ) || null
    : chapterLevels[chapterLevelIndex + 1] || null;

  const completeLevel = useCallback(async (finalMoveCount) => {
    playVictorySound();
    try {
      await saveCompletedLevel(level.id);
      const { isNewBest } = await saveBestScore(level.id, finalMoveCount);
      if (isNewBest) {
        setIsNewBestScore(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown storage error.';
      setCompletionSaveError(message);
    }
    setIsChapterCompletionVisible(isChapterFinalLevel);
    setIsCompletionVisible(true);
  }, [isChapterFinalLevel, level, playVictorySound]);

  const handleGoHome = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }, []);

  const handleBackToLevels = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }, []);

  const handleNextLevel = useCallback(() => {
    if (!nextLevel) {
      return;
    }
    router.replace({ pathname: '/game', params: { levelId: nextLevel.id } });
  }, [nextLevel]);

  const handleRetryLevel = useCallback(() => {
    if (!level) {
      return;
    }
    hasWon.current = false;
    hasLost.current = false;
    setCurrentTree(createAllRedTree(level.tree));
    setMoveCount(0);
    setLockedNodeInfo(null);
    setSpecialMoves(3);
    setIsSpecialMoveActive(false);
    setIsCompletionVisible(false);
    setIsChapterCompletionVisible(false);
    setIsOutOfMovesVisible(false);
    setCompletionSaveError(null);
    setIsNewBestScore(false);
    setIsRestartConfirmVisible(false);
  }, [level]);

  const handleNodePress = useCallback(
    (nodeId, nodeAnchor) => {
      if (!currentTree || !targetTree || hasWon.current || hasLost.current) {
        return;
      }
      if (nodeLocks[nodeId] && moveCount >= nodeLocks[nodeId]) {
        setLockedNodeInfo({ nodeId, lockAfterMoves: nodeLocks[nodeId], anchor: nodeAnchor });
        return;
      }
      setLockedNodeInfo(null);

      const useSpecialMove = isSpecialMoveActive && specialMoves > 0;
      const nextTree = useSpecialMove
        ? flipSingleNode(nodeId, currentTree)
        : flipSubtree(nodeId, currentTree);

      if (nextTree === currentTree) {
        return;
      }

      const nextMoveCount = moveCount + 1;
      setCurrentTree(nextTree);
      setMoveCount(nextMoveCount);

      if (useSpecialMove) {
        playSpecialSound();
        setSpecialMoves((count) => count - 1);
        if (specialMoves === 1) {
          setIsSpecialMoveActive(false);
        }
      } else {
        playFlipSound();
      }

      if (checkWinCondition(nextTree, targetTree)) {
        hasWon.current = true;
        void completeLevel(nextMoveCount);
      } else if (moveLimit && nextMoveCount >= moveLimit) {
        hasLost.current = true;
        playFailSound();
        setIsOutOfMovesVisible(true);
      }
    },
    [
      completeLevel,
      currentTree,
      isSpecialMoveActive,
      moveCount,
      moveLimit,
      nodeLocks,
      playFailSound,
      playFlipSound,
      playSpecialSound,
      setCurrentTree,
      setIsOutOfMovesVisible,
      setLockedNodeInfo,
      setIsSpecialMoveActive,
      setMoveCount,
      setSpecialMoves,
      specialMoves,
      targetTree,
    ],
  );

  if (!level || !currentTree || !targetTree) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.missingLevel}>
          <Text style={[styles.title, { color: colors.ink }]}>Level not found</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            That level is not available in this build.
          </Text>
          <Pressable
            onPress={handleBackToLevels}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.primaryButtonText}>Back to levels</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const specialInfoCardWidth = Math.min(300, Math.max(0, windowWidth - 32));

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to levels"
            onPress={handleBackToLevels}
            hitSlop={10}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <Text style={[styles.backText, { color: colors.primary }]}>‹  Levels</Text>
          </Pressable>
        </View>

        {chapter ? (
          <Text style={[styles.chapterEyebrow, { color: colors.primary }]}>
            CHAPTER {String(GAME_CHAPTERS.indexOf(chapter) + 1).padStart(2, '0')} · {chapter.title}
          </Text>
        ) : null}
        <Text style={[styles.title, { color: colors.ink }]}>{level.name}</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          {chapter?.moveLimitMode !== 'none'
            ? chapter.description
            : 'Make your tree match the target.'}
        </Text>
        <View
          style={[
            styles.panel,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.panelHeading}>
            <Text style={[styles.panelTitle, { color: colors.ink }]}>TARGET TREE</Text>
            <Text style={[styles.readOnly, { color: colors.muted }]}>READ ONLY</Text>
          </View>
          <TreeRenderer tree={targetTree} scale={0.58} fitToWidth />
        </View>

        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.card,
              borderColor: colors.primary,
              borderWidth: 1.5,
            },
          ]}
        >
          <View style={styles.panelHeading}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Restart level"
              onPress={() => {
                playTapSound();
                setIsRestartConfirmVisible(true);
              }}
              hitSlop={6}
              style={({ pressed }) => [
                styles.restartButton,
                { backgroundColor: colors.palePrimary, borderColor: colors.cardBorder },
                pressed && styles.pressedButton,
              ]}
            >
              <Image
                source={require('../../assets/images/restart.png')}
                style={[styles.restartIcon, { tintColor: colors.primary }]}
              />
            </Pressable>
            <View style={styles.moveLimitSlot}>
              {moveLimit ? <View
                accessibilityLabel={`${Math.max(0, moveLimit - moveCount)} moves remaining out of ${moveLimit}`}
                style={[
                  styles.moveLimitCard,
                  { backgroundColor: colors.palePrimary, borderColor: colors.cardBorder },
                ]}
              >
                <Text style={[styles.moveLimitLabel, { color: colors.muted }]}>MOVES LEFT</Text>
                <Text style={[styles.moveLimitText, { color: colors.primary }]}>
                  {Math.max(0, moveLimit - moveCount)}
                </Text>
                <Text style={[styles.moveLimitTotal, { color: colors.muted }]}>of {moveLimit}</Text>
              </View> : null}
            </View>
            <View style={styles.specialControl}>
              <View style={styles.specialToggleColumn}>
                <Pressable
                  ref={specialInfoLinkRef}
                  accessibilityRole="button"
                  accessibilityLabel="Special move information"
                  onPress={() => {
                    playTapSound();
                    if (isSpecialInfoVisible) {
                      setIsSpecialInfoVisible(false);
                      return;
                    }
                    specialInfoLinkRef.current?.measureInWindow((x, y, width, height) => {
                      setSpecialInfoAnchor({ x, y, width, height });
                      setIsSpecialInfoVisible(true);
                    });
                  }}
                  hitSlop={8}
                  style={styles.specialInfoLink}
                >
                  <Text style={[styles.specialInfoLinkText, { color: colors.primary }]}>Special </Text>
                  <Text style={[styles.specialInfoLinkText, styles.specialInfoLinkIcon, { color: colors.primary }]}>ⓘ</Text>
                </Pressable>
                
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel={`Special move, ${specialMoves} remaining`}
                  accessibilityState={{
                    checked: isSpecialMoveActive,
                    disabled: specialMoves === 0,
                  }}
                  disabled={specialMoves === 0}
                  onPress={() => {
                    playTapSound();
                    setIsSpecialMoveActive((active) => !active);
                  }}
                  style={({ pressed }) => [
                    styles.specialToggleTarget,
                    pressed && specialMoves > 0 && styles.specialTogglePressed,
                  ]}
                >
                  <View
                    style={[
                      styles.toggle,
                      { backgroundColor: isSpecialMoveActive ? colors.primary : '#D5DDD6' },
                      specialMoves === 0 && styles.toggleDisabled,
                    ]}
                  >
                    <View style={[styles.toggleKnob, isSpecialMoveActive && styles.toggleKnobActive]} />
                  </View>
                  <Text style={[styles.movesRemaining, { color: colors.accent }]}>
                    {Math.min(specialMoves, moveLimit - moveCount)} left
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
          <TreeRenderer
            tree={currentTree}
            onNodePress={handleNodePress}
            nodeLocks={nodeLocks}
            moveCount={moveCount}
            lockedNodeIds={lockedNodeIds}
            fitToWidth
          />
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={isRestartConfirmVisible}
        onRequestClose={() => setIsRestartConfirmVisible(false)}
      >
        <View style={styles.completionBackdrop}>
          <View
            accessibilityViewIsModal
            accessibilityRole="alert"
            style={[
              styles.completionCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View style={[styles.completionMark, { backgroundColor: colors.palePrimary }]}>
              <Text style={[styles.completionMarkText, { color: colors.primary }]}>↻</Text>
            </View>
            <Text style={[styles.completionTitle, { color: colors.ink }]}>Restart this level?</Text>
            <Text style={[styles.completionMessage, { color: colors.muted }]}>
              Your tree and move count will be reset.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                playTapSound();
                handleRetryLevel();
              }}
              style={({ pressed }) => [
                styles.completionPrimaryButton,
                { backgroundColor: colors.primary },
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>Restart Level</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                playTapSound();
                setIsRestartConfirmVisible(false);
              }}
              style={({ pressed }) => [
                styles.homeButton,
                { backgroundColor: colors.palePrimary },
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={[styles.homeButtonText, { color: colors.primary }]}>Keep Playing</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isSpecialInfoVisible}
        onRequestClose={() => setIsSpecialInfoVisible(false)}
      >
        <View style={styles.specialInfoModalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss special move information"
            onPress={() => setIsSpecialInfoVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.specialInfoPopover,
              {
                backgroundColor: colors.palePrimary,
                borderColor: colors.primary,
                left: specialInfoAnchor
                  ? Math.max(
                      16,
                      Math.min(
                        specialInfoAnchor.x + specialInfoAnchor.width - specialInfoCardWidth,
                        windowWidth - specialInfoCardWidth - 16,
                      ),
                    )
                  : 16,
                top: specialInfoAnchor
                  ? specialInfoAnchor.y >= 90
                    ? specialInfoAnchor.y - 72
                    : specialInfoAnchor.y + specialInfoAnchor.height + 8
                  : 112,
                width: specialInfoCardWidth,
              },
            ]}
          >
            <View style={styles.specialInfoPopoverHeader}>
              <Text style={[styles.specialInfoPopoverTitle, { color: colors.primary }]}>Special Move:</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close special move information"
                onPress={() => setIsSpecialInfoVisible(false)}
                hitSlop={8}
                style={styles.specialInfoCloseButton}
              >
                <Text style={[styles.specialInfoCloseText, { color: colors.ink }]}>×</Text>
              </Pressable>
            </View>
            <Text style={[styles.specialInfoPopoverText, { color: colors.ink }]}>
              Flip one node without changing its descendants.
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={Boolean(lockedNodeInfo)}
        onRequestClose={() => setLockedNodeInfo(null)}
      >
        <View style={styles.specialInfoModalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss node lock information"
            onPress={() => setLockedNodeInfo(null)}
            style={StyleSheet.absoluteFill}
          />
          {lockedNodeInfo ? (
            <View
              accessibilityViewIsModal
              accessibilityRole="alert"
              style={[
                styles.specialInfoPopover,
                {
                  backgroundColor: colors.palePrimary,
                  borderColor: colors.primary,
                  left: lockedNodeInfo.anchor
                    ? Math.max(16, Math.min(
                        lockedNodeInfo.anchor.x + lockedNodeInfo.anchor.width - specialInfoCardWidth,
                        windowWidth - specialInfoCardWidth - 16,
                      ))
                    : 16,
                  top: lockedNodeInfo.anchor?.y >= 105
                    ? lockedNodeInfo.anchor.y - 92
                    : (lockedNodeInfo.anchor?.y || 112) + (lockedNodeInfo.anchor?.height || 0) + 8,
                  width: specialInfoCardWidth,
                },
              ]}
            >
              <View style={styles.specialInfoPopoverHeader}>
                <Text style={[styles.specialInfoPopoverTitle, { color: colors.primary }]}>Node Locked!</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close node lock information"
                  onPress={() => setLockedNodeInfo(null)}
                  hitSlop={8}
                  style={styles.specialInfoCloseButton}
                >
                  <Text style={[styles.specialInfoCloseText, { color: colors.ink }]}>×</Text>
                </Pressable>
              </View>
              <Text style={[styles.specialInfoPopoverText, { color: colors.ink }]}>
                This node locks after {lockedNodeInfo.lockAfterMoves} moves. Parent flips can still change its color.
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={handleGoHome}
        transparent
        visible={isCompletionVisible || isOutOfMovesVisible}
      >
        <View style={styles.completionBackdrop}>
          <View
            accessibilityViewIsModal
            style={[
              styles.completionCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            accessibilityRole="alert"
          >
            <View
              style={[
                styles.completionMark,
                { backgroundColor: colors.palePrimary },
              ]}
            >
              <Text style={[styles.completionMarkText, { color: colors.primary }]}>
                {isOutOfMovesVisible ? '↻' : '✓'}
              </Text>
            </View>
            <Text style={[styles.completionTitle, { color: colors.ink }]}>
              {isOutOfMovesVisible
                ? 'Out of moves!'
                : isChapterCompletionVisible
                  ? 'Chapter complete!'
                  : 'Level complete!'}
            </Text>
            <Text style={[styles.completionMessage, { color: colors.muted }]}>
              {isOutOfMovesVisible
                ? 'Your move limit ran out before the trees matched. Try a different strategy.'
                : isChapterCompletionVisible
                  ? `Congratulations! You completed ${chapter.title}.${nextChapter ? ` ${nextChapter.title} is ready when you are.` : ' You have completed every chapter.'}`
                  : `You matched the tree in ${moveCount} ${moveCount === 1 ? 'move' : 'moves'}.`}
            </Text>
            {isNewBestScore && (
              <View
                style={[
                  styles.bestScoreBadge,
                  { backgroundColor: colors.palePrimary },
                ]}
              >
                <Text style={[styles.bestScoreBadgeText, { color: colors.primary }]}>
                  ★ New Best Score!
                </Text>
              </View>
            )}
            {completionSaveError ? (
              <Text accessibilityRole="alert" style={styles.completionError}>
                Progress could not be saved: {completionSaveError}
              </Text>
            ) : null}
            {isOutOfMovesVisible ? (
              <Pressable
                accessibilityRole="button"
                onPress={handleRetryLevel}
                style={({ pressed }) => [
                  styles.completionPrimaryButton,
                  { backgroundColor: colors.primary },
                  pressed && styles.pressedButton,
                ]}
              >
                <Text style={styles.primaryButtonText}>Retry Level</Text>
              </Pressable>
            ) : nextLevel ? (
              <Pressable
                accessibilityRole="button"
                onPress={handleNextLevel}
                style={({ pressed }) => [
                  styles.completionPrimaryButton,
                  { backgroundColor: colors.primary },
                  pressed && styles.pressedButton,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {isChapterCompletionVisible
                    ? `Continue to ${nextChapter.title}`
                    : 'Go to Next Level'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={handleGoHome}
              style={({ pressed }) => [
                nextLevel && !isOutOfMovesVisible ? styles.homeButton : styles.completionPrimaryButton,
                {
                  backgroundColor:
                    nextLevel && !isOutOfMovesVisible ? colors.palePrimary : colors.primary,
                },
                pressed && styles.pressedButton,
              ]}
            >
              <Text
                style={
                  nextLevel && !isOutOfMovesVisible
                    ? [styles.homeButtonText, { color: colors.primary }]
                    : styles.primaryButtonText
                }
              >
                Go to Home
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
    paddingHorizontal: 18,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 88,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backText: {
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    marginTop: 12,
  },
  chapterEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 18,
    marginTop: 4,
  },
  moveLimitCard: {
    alignSelf: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  moveLimitLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  moveLimitText: {
    fontSize: 14,
    fontWeight: '800',
  },
  moveLimitTotal: {
    fontSize: 11,
    fontWeight: '700',
  },
  panel: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  panelHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 14,
  },
  moveLimitSlot: {
    alignItems: 'center',
    flex: 1,
  },
  restartButton: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: 'center',
    height: 36,
    marginRight: 8,
    width: 36,
  },
  restartIcon: {
    height: 22,
    width: 22,
    resizeMode: 'contain',
  },
  readOnly: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  specialControl: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  specialToggleColumn: {
    alignItems: 'center',
  },
  specialToggleTarget: {
    alignItems: 'center',
    borderRadius: 12,
    gap: 4,
    minWidth: 58,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  specialTogglePressed: {
    opacity: 0.72,
  },
  specialInfoLink: {
    flexDirection: 'row',
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialInfoLinkText: {
    fontSize: 10,
    fontWeight: '700',
  },
  specialInfoLinkIcon: {
    fontSize: 13,
    lineHeight: 15,
  },
  specialInfoModalRoot: {
    flex: 1,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  specialInfoPopover: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  specialInfoPopoverHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  specialInfoPopoverText: {
    fontSize: 13,
    lineHeight: 18,
    paddingRight: 8,
  },
  specialInfoPopoverTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  specialInfoCloseButton: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    marginRight: -6,
    marginTop: -4,
    width: 26,
  },
  specialInfoCloseText: {
    fontSize: 23,
    lineHeight: 25,
  },
  toggle: {
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 3,
    width: 52,
  },
  toggleDisabled: {
    opacity: 0.5,
  },
  toggleKnob: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 24,
    width: 24,
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  movesRemaining: {
    fontSize: 10,
    fontWeight: '800',
  },
  missingLevel: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  primaryButton: {
    borderRadius: 14,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  completionBackdrop: {
    alignItems: 'center',
    backgroundColor: '#00000088',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  completionCard: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: 380,
    padding: 26,
    width: '100%',
  },
  completionMark: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  completionMarkText: {
    fontSize: 30,
    fontWeight: '800',
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 16,
  },
  completionMessage: {
    fontSize: 14,
    marginTop: 7,
    textAlign: 'center',
  },
  bestScoreBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  bestScoreBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  completionError: {
    color: '#B33E3E',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center',
  },
  homeButton: {
    alignItems: 'center',
    borderRadius: 14,
    marginTop: 10,
    padding: 14,
    width: '100%',
  },
  homeButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  completionPrimaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    marginTop: 20,
    padding: 14,
    width: '100%',
  },
  pressedButton: {
    opacity: 0.8,
  },
});
