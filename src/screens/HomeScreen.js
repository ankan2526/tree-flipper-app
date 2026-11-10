import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';

import TreeRenderer, { getTreeNaturalWidth } from '../components/TreeRenderer';
import { GAME_LEVELS } from '../data/levels';
import { getBestScores, getCompletedLevels } from '../utils/storage';
import { useAppTheme } from '../context/ThemeContext';
import SettingsModal from './SettingsModal';

const PREVIEW_SCALE = 0.55;
const CARD_HORIZONTAL_PADDING = 12;
const SCREEN_HORIZONTAL_PADDING = 18;
const GRID_GAP = 12;
// Default fallback width for SSR/initial render before client window dimensions hydrate
const DEFAULT_WINDOW_WIDTH = 375;

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [completedLevels, setCompletedLevels] = useState([]);
  const [bestScores, setBestScores] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isMounted = useRef(false);

  // Available width for a card in a 2-column layout:
  // Use a stable width on server/initial render so SSR matches initial client render
  const effectiveWindowWidth = windowWidth || DEFAULT_WINDOW_WIDTH;
  const availableContentWidth = effectiveWindowWidth - SCREEN_HORIZONTAL_PADDING * 2;
  const halfCardWidth = (availableContentWidth - GRID_GAP) / 2;
  const halfCardInnerWidth = Math.max(0, halfCardWidth - CARD_HORIZONTAL_PADDING * 2);

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

  // Determine whether each level needs a full-width row or can share a 2-column row
  // A tree overflows half-card preview if its scaled width exceeds the inner preview box width.
  const levelItems = GAME_LEVELS.map((level, index) => {
    const naturalWidth = getTreeNaturalWidth(level.tree);
    const scaledWidth = naturalWidth * PREVIEW_SCALE;
    const isFullWidth = scaledWidth > halfCardInnerWidth;
    return {
      ...level,
      index,
      isFullWidth,
    };
  });

  // Group items into visual rows:
  // - If isFullWidth: takes an entire row (1 item)
  // - Otherwise: paired with the next non-full-width item into a 2-item row
  const rows = [];
  let pendingHalfItem = null;

  for (let i = 0; i < levelItems.length; i++) {
    const item = levelItems[i];
    if (item.isFullWidth) {
      if (pendingHalfItem) {
        rows.push({ id: `row-${pendingHalfItem.id}`, items: [pendingHalfItem] });
        pendingHalfItem = null;
      }
      rows.push({ id: `row-${item.id}`, items: [item] });
    } else {
      if (pendingHalfItem) {
        rows.push({ id: `row-${pendingHalfItem.id}-${item.id}`, items: [pendingHalfItem, item] });
        pendingHalfItem = null;
      } else {
        pendingHalfItem = item;
      }
    }
  }
  if (pendingHalfItem) {
    rows.push({ id: `row-${pendingHalfItem.id}`, items: [pendingHalfItem] });
  }

  const renderCard = (item, isSingleInRow) => {
    const isComplete = completedLevels.includes(item.id);
    const isUnlocked = item.index === 0 || completedLevels.includes(GAME_LEVELS[item.index - 1].id);
    const bestScore = bestScores[item.id];

    return (
      <Pressable
        key={item.id}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}${!isUnlocked ? ', locked' : isComplete ? ', completed' : ''}`}
        disabled={!isUnlocked}
        onPress={() => {
          if (!isUnlocked) return;
          router.push({ pathname: '/game', params: { levelId: item.id } });
        }}
        style={({ pressed }) => [
          styles.levelCard,
          isSingleInRow ? styles.fullWidthCard : styles.halfWidthCard,
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
            LEVEL {String(item.index + 1).padStart(2, '0')}
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
          <TreeRenderer tree={item.tree} scale={PREVIEW_SCALE} />
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

  const renderRow = ({ item: row }) => {
    const isSingle = row.items.length === 1;
    return (
      <View style={styles.levelRow}>
        {row.items.map((item) => renderCard(item, isSingle))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={renderRow}
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
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: GRID_GAP,
    marginBottom: 12,
  },
  levelCard: {
    borderRadius: 18,
    minHeight: 215,
    overflow: 'hidden',
    padding: CARD_HORIZONTAL_PADDING,
    justifyContent: 'space-between',
  },
  halfWidthCard: {
    flex: 1,
  },
  fullWidthCard: {
    width: '100%',
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
