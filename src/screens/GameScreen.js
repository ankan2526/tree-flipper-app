import { useCallback, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import TreeRenderer from '../components/TreeRenderer';
import { GAME_LEVELS } from '../data/levels';
import {
  checkWinCondition,
  flipSingleNode,
  flipSubtree,
} from '../utils/gameLogic';
import { saveBestScore, saveCompletedLevel } from '../utils/storage';
import { useAppTheme } from '../context/ThemeContext';

function createAllRedTree(node) {
  return {
    ...node,
    targetColor: 'red',
    children: (node.children || []).map(createAllRedTree),
  };
}

export default function GameScreen({ levelId }) {
  const { colors } = useAppTheme();
  const level = GAME_LEVELS.find((item) => item.id === levelId);
  const [currentTree, setCurrentTree] = useState(() =>
    level ? createAllRedTree(level.tree) : null,
  );
  const [targetTree] = useState(() => level?.tree ?? null);
  const [specialMoves, setSpecialMoves] = useState(3);
  const [isSpecialMoveActive, setIsSpecialMoveActive] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [isCompletionVisible, setIsCompletionVisible] = useState(false);
  const [completionSaveError, setCompletionSaveError] = useState(null);
  const [isNewBestScore, setIsNewBestScore] = useState(false);
  const hasWon = useRef(false);
  const levelIndex = GAME_LEVELS.findIndex((item) => item.id === levelId);
  const nextLevel = levelIndex >= 0 ? GAME_LEVELS[levelIndex + 1] : null;

  const completeLevel = useCallback(async (finalMoveCount) => {
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
    setIsCompletionVisible(true);
  }, [level]);

  const handleGoHome = useCallback(() => {
    router.replace('/');
  }, []);

  const handleNextLevel = useCallback(() => {
    if (!nextLevel) {
      return;
    }
    router.replace({ pathname: '/game', params: { levelId: nextLevel.id } });
  }, [nextLevel]);

  const handleNodePress = useCallback(
    (nodeId) => {
      if (!currentTree || !targetTree || hasWon.current) {
        return;
      }

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
        setSpecialMoves((count) => count - 1);
        if (specialMoves === 1) {
          setIsSpecialMoveActive(false);
        }
      }

      if (checkWinCondition(nextTree, targetTree)) {
        hasWon.current = true;
        void completeLevel(nextMoveCount);
      }
    },
    [completeLevel, currentTree, isSpecialMoveActive, moveCount, specialMoves, targetTree],
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
            onPress={() => router.back()}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.primaryButtonText}>Back to levels</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to levels"
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.backButton}
          >
            <Text style={[styles.backText, { color: colors.primary }]}>‹  Levels</Text>
          </Pressable>
          <Text style={[styles.moveCounter, { color: colors.muted }]}>MOVES {moveCount}</Text>
        </View>

        <Text style={[styles.title, { color: colors.ink }]}>{level.name}</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Make your tree match the target.
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
          <TreeRenderer tree={targetTree} scale={0.58} />
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
            <Text style={[styles.panelTitle, { color: colors.ink }]}>YOUR TREE</Text>
            <Text style={[styles.tapHint, { color: colors.muted }]}>
              TAP A NODE TO FLIP ITS BRANCH
            </Text>
          </View>
          <TreeRenderer tree={currentTree} onNodePress={handleNodePress} />
        </View>

        <View
          style={[
            styles.specialCard,
            { backgroundColor: colors.palePrimary, borderColor: colors.cardBorder },
          ]}
        >
          <View style={styles.specialCopy}>
            <Text style={[styles.specialTitle, { color: colors.ink }]}>Special Move</Text>
            <Text style={[styles.specialDescription, { color: colors.muted }]}>
              Flip one node without changing its descendants.
            </Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{
              checked: isSpecialMoveActive,
              disabled: specialMoves === 0,
            }}
            disabled={specialMoves === 0}
            onPress={() => setIsSpecialMoveActive((active) => !active)}
            style={[
              styles.toggle,
              { backgroundColor: isSpecialMoveActive ? colors.primary : '#D5DDD6' },
              specialMoves === 0 && styles.toggleDisabled,
            ]}
          >
            <View style={[styles.toggleKnob, isSpecialMoveActive && styles.toggleKnobActive]} />
          </Pressable>
          <Text style={[styles.movesRemaining, { color: colors.accent }]}>
            {specialMoves} remaining
          </Text>
          <Text style={[styles.specialStatus, { color: colors.muted }]}>
            {specialMoves === 0
              ? 'No special moves left'
              : isSpecialMoveActive
                ? 'Special Move Active'
                : 'Special Move Inactive'}
          </Text>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={handleGoHome}
        transparent
        visible={isCompletionVisible}
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
              <Text style={[styles.completionMarkText, { color: colors.primary }]}>✓</Text>
            </View>
            <Text style={[styles.completionTitle, { color: colors.ink }]}>Level complete!</Text>
            <Text style={[styles.completionMessage, { color: colors.muted }]}>
              You matched the tree in {moveCount} {moveCount === 1 ? 'move' : 'moves'}.
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
            {nextLevel ? (
              <Pressable
                accessibilityRole="button"
                onPress={handleNextLevel}
                style={({ pressed }) => [
                  styles.completionPrimaryButton,
                  { backgroundColor: colors.primary },
                  pressed && styles.pressedButton,
                ]}
              >
                <Text style={styles.primaryButtonText}>Go to Next Level</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={handleGoHome}
              style={({ pressed }) => [
                nextLevel ? styles.homeButton : styles.completionPrimaryButton,
                { backgroundColor: nextLevel ? colors.palePrimary : colors.primary },
                pressed && styles.pressedButton,
              ]}
            >
              <Text
                style={
                  nextLevel
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
    paddingVertical: 8,
  },
  backText: {
    fontSize: 15,
    fontWeight: '700',
  },
  moveCounter: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 18,
    marginTop: 4,
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
  panelTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  readOnly: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  tapHint: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  specialCard: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
    padding: 14,
  },
  specialCopy: {
    flex: 1,
    paddingRight: 10,
  },
  specialTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  specialDescription: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
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
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 8,
  },
  specialStatus: {
    flexBasis: '100%',
    fontSize: 11,
    marginTop: 8,
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
