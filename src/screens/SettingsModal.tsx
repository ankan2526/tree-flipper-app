import React from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { THEMES, ThemeName, useAppTheme } from '@/context/ThemeContext';
import { resetAllProgress } from '@/utils/storage';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onProgressReset?: () => void;
}

export default function SettingsModal({
  visible,
  onClose,
  onProgressReset,
}: SettingsModalProps) {
  const { colors, themeName, setTheme } = useAppTheme();

  const handleResetProgress = () => {
    Alert.alert(
      'Reset All Progress?',
      'This will lock all levels beyond Level 1 and erase all your best scores. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset Progress',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetAllProgress();
              if (onProgressReset) {
                onProgressReset();
              }
              Alert.alert('Success', 'Game progress has been reset.');
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Storage error';
              Alert.alert('Error', `Could not reset progress: ${msg}`);
            }
          },
        },
      ],
    );
  };

  const themeKeys = Object.keys(THEMES) as ThemeName[];

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      visible={visible}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.ink }]}>Settings</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close settings"
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [
              styles.doneButton,
              { backgroundColor: colors.palePrimary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.doneButtonText, { color: colors.primary }]}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* THEMES SECTION */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>THEME</Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              {themeKeys.map((key, index) => {
                const item = THEMES[key];
                const isSelected = themeName === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => void setTheme(key)}
                    style={({ pressed }) => [
                      styles.themeRow,
                      index < themeKeys.length - 1 && [
                        styles.themeRowBorder,
                        { borderBottomColor: colors.cardBorder },
                      ],
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.themeInfo}>
                      <View style={styles.colorDots}>
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: item.colors.primary },
                          ]}
                        />
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: item.colors.nodeBlue },
                          ]}
                        />
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: item.colors.nodeRed },
                          ]}
                        />
                      </View>
                      <Text style={[styles.themeLabel, { color: colors.ink }]}>
                        {item.name}
                      </Text>
                    </View>
                    {isSelected && (
                      <View
                        style={[
                          styles.checkBadge,
                          { backgroundColor: colors.primary },
                        ]}
                      >
                        <Text style={styles.checkText}>✓</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* PROGRESS SECTION */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>DATA & PROGRESS</Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                onPress={handleResetProgress}
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed && styles.pressed,
                ]}
              >
                <View>
                  <Text style={styles.dangerLabel}>Reset Progress</Text>
                  <Text style={[styles.dangerDescription, { color: colors.muted }]}>
                    Lock levels & clear all best move scores
                  </Text>
                </View>
                <Text style={styles.dangerArrow}>→</Text>
              </Pressable>
            </View>
          </View>

          {/* ABOUT SECTION */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>ABOUT</Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <View style={styles.aboutRow}>
                <Text style={[styles.aboutLabel, { color: colors.ink }]}>Game</Text>
                <Text style={[styles.aboutValue, { color: colors.muted }]}>Tree Flipper</Text>
              </View>
              <View
                style={[
                  styles.aboutRow,
                  styles.themeRowBorder,
                  { borderBottomColor: colors.cardBorder, borderTopColor: colors.cardBorder, borderTopWidth: 1 },
                ]}
              >
                <Text style={[styles.aboutLabel, { color: colors.ink }]}>Version</Text>
                <Text style={[styles.aboutValue, { color: colors.muted }]}>1.0.0</Text>
              </View>
              <View style={styles.aboutInfoBox}>
                <Text style={[styles.aboutStory, { color: colors.muted }]}>
                  Tree Flipper is a tree-structure logic puzzle game. Tap any node to invert its whole subtree or use your limited special moves to flip individual nodes and match the target pattern in minimum moves.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  doneButton: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 40,
    paddingTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  themeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  themeRowBorder: {
    borderBottomWidth: 1,
  },
  themeInfo: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  colorDots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  themeLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dangerLabel: {
    color: '#D94343',
    fontSize: 15,
    fontWeight: '700',
  },
  dangerDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  dangerArrow: {
    color: '#D94343',
    fontSize: 16,
    fontWeight: '700',
  },
  aboutRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  aboutLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  aboutValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  aboutInfoBox: {
    padding: 16,
  },
  aboutStory: {
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.7,
  },
});

