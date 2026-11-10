import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';

import TreeRenderer from '../components/TreeRenderer';
import { GAME_LEVELS } from '../data/levels';
import { getBestScores, getCompletedLevels } from '../utils/storage';
import { useAppTheme } from '../context/ThemeContext';
import SettingsModal from './SettingsModal';

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const [completedLevels, setCompletedLevels] = useState([]);
  const [bestScores, setBestScores] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isMounted = useRef(false);

  const loadProgress = useCallback(async () => {
    try {
      const [completed, scores] = await Promise.all([
        getCompletedLevels(),
        getBestScores(),
      ]);
      if (isMounted.current) {
        setCompletedLevels(completed);
        setBestScores(scores || {});
      }
    } catch (error) {
      if (isMounted.current) {
        const message = error instanceof Error ? error.message : 'Unknown storage error.';
        Alert.alert('Progress unavailable', `Could not load saved progress. ${message}`);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProgress();
      return undefined;
    }, [loadProgress]),
  );

  const renderLevel = ({ item, index }) => {
    const isComplete = completedLevels.includes(item.id);
    // Level 1 is always unlocked. Next levels are unlocked if the previous level is complete.
    const isUnlocked = index === 0 || completedLevels.includes(GAME_LEVELS[index - 1].id);
    const bestScore = bestScores[item.id];

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}${!isUnlocked ? ', locked' : isComplete ? ', completed' : ''}`}
        disabled={!isUnlocked}
        onPress={() => {
          if (!isUnlocked) return;
          router.push({ pathname: '/game', params: { levelId: item.id } });
        }}
        style={({ pressed }) => [
          styles.levelCard,
          {
            backgroundColor: isUnlocked ? colors.card : colors.lockedBg,
            borderColor: !isUnlocked
              ? colors.lockedBorder
              : isComplete
                ? colors.primary
                : colors.cardBorder,
            borderWidth: isComplete ? 2 : 1,
            opacity: isUnlocked ? 1 : 0.75,
          },
          pressed && isUnlocked && styles.pressedCard,
        ]}
      >
        <View style={styles.levelHeader}>
          <Text
            style={[
              styles.levelNumber,
              { color: isUnlocked ? colors.muted : colors.lockedText },
            ]}
          >
            LEVEL {String(index + 1).padStart(2, '0')}
          </Text>
          {isComplete ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>✓</Text>
            </View>
          ) : !isUnlocked ? (
            <View style={[styles.lockBadge, { backgroundColor: colors.lockedBorder }]}>
              <Text style={[styles.lockIcon, { color: colors.lockedText }]}>🔒</Text>
            </View>
          ) : null}
        </View>

        <Text
          style={[
            styles.levelName,
            { color: isUnlocked ? colors.ink : colors.lockedText },
          ]}
          numberOfLines={1}
        >
          {item.name}
        </Text>

        <View style={styles.treePreviewWrapper}>
          <TreeRenderer tree={item.tree} scale={0.55} />
        </View>

        <View style={styles.levelBottom}>
          {bestScore !== undefined ? (
            <Text style={[styles.bestScoreText, { color: colors.accent }]}>
              ★ Best: {bestScore} {bestScore === 1 ? 'move' : 'moves'}
            </Text>
          ) : null}

          <Text
            style={[
              styles.levelAction,
              {
                color: !isUnlocked
                  ? colors.lockedText
                  : isComplete
                    ? colors.primary
                    : colors.primary,
              },
            ]}
          >
            {!isUnlocked
              ? 'Locked'
              : isComplete
                ? 'Play again →'
                : 'Tap to play →'}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <FlatList
        data={GAME_LEVELS}
        keyExtractor={(item) => item.id}
        renderItem={renderLevel}
        numColumns={2}
        columnWrapperStyle={styles.levelRow}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.heading}>
            <View style={styles.headerTopBar}>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>
                A LITTLE LOGIC, A LOT OF FLIPPING
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open settings"
                onPress={() => setIsSettingsOpen(true)}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.settingsIconBtn,
                  { backgroundColor: colors.palePrimary },
                  pressed && styles.pressedCard,
                ]}
              >
                <Text style={[styles.settingsIconText, { color: colors.primary }]}>⚙</Text>
              </Pressable>
            </View>
            <Text style={[styles.title, { color: colors.ink }]}>Tree Flipper</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Match the colors. Think in branches.
            </Text>
            <View
              style={[
                styles.progressPill,
                { backgroundColor: colors.palePrimary },
              ]}
            >
              <Text style={[styles.progressText, { color: colors.primary }]}>
                {completedLevels.length} / {GAME_LEVELS.length} levels complete
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={null}
        ListFooterComponent={<View style={styles.footerSpacing} />}
      />
      {isLoading ? (
        <View
          style={[
            styles.loadingOverlay,
            { backgroundColor: `${colors.background}AA` },
          ]}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      <SettingsModal
        visible={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onProgressReset={() => {
          void loadProgress();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 36,
  },
  heading: {
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  settingsIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIconText: {
    fontSize: 18,
    lineHeight: 20,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    marginTop: 7,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 5,
  },
  progressPill: {
    alignSelf: 'flex-start',
    borderRadius: 18,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
  },
  levelRow: {
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  levelCard: {
    borderRadius: 18,
    flex: 1,
    minHeight: 215,
    overflow: 'hidden',
    padding: 12,
    justifyContent: 'space-between',
  },
  pressedCard: {
    opacity: 0.8,
  },
  levelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  levelNumber: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  badge: {
    alignItems: 'center',
    borderRadius: 11,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  lockBadge: {
    alignItems: 'center',
    borderRadius: 11,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  lockIcon: {
    fontSize: 11,
  },
  levelName: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 4,
  },
  treePreviewWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 4,
  },
  levelBottom: {
    marginTop: 'auto',
    paddingTop: 8,
  },
  bestScoreText: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  levelAction: {
    fontSize: 12,
    fontWeight: '700',
  },
  footerSpacing: {
    height: 32,
  },
  loadingOverlay: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
