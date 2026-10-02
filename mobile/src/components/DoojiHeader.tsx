import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';

import { useTheme } from '../design/theme';
import { motion, radius, spacing, type } from '../design/tokens';
import { useApp } from '../state/AppContext';
import { DoojiWordmark } from './DoojiWordmark';

interface Props {
  showWordmark?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  title?: string;
  showLibrary?: boolean;
  /** When set, replaces default Library navigation (use for leave guards). */
  onLibraryPress?: () => void;
  showThemeToggle?: boolean;
}

export function DoojiHeader({
  showWordmark = true,
  showBack = false,
  onBack,
  title,
  showLibrary = true,
  onLibraryPress,
  showThemeToggle = true,
}: Props) {
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const app = useApp();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  const openLibrary = () => {
    if (onLibraryPress) {
      onLibraryPress();
      return;
    }
    app.requestLeave({ type: 'library' }, () => router.push('/library'));
  };

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            hitSlop={10}
            style={styles.backHit}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.ink} />
          </Pressable>
        ) : null}
        {showWordmark ? (
          <View style={styles.wordmark}>
            <DoojiWordmark ink={colors.ink} height={26} />
          </View>
        ) : null}
        {title ? (
          <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
        ) : null}
      </View>

      <View style={styles.right}>
        {showLibrary ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Library"
            onPress={openLibrary}
            style={[styles.libraryBtn, { backgroundColor: colors.libraryBtn }]}
            hitSlop={6}
          >
            <MaterialIcons
              name="grid-view"
              size={18}
              color={colors.libraryIcon}
            />
          </Pressable>
        ) : null}
        {showThemeToggle ? (
          <ThemeToggle
            isDark={isDark}
            onToggle={toggleTheme}
            reduceMotion={reduceMotion}
          />
        ) : null}
      </View>
    </View>
  );
}

function ThemeToggle({
  isDark,
  onToggle,
  reduceMotion,
}: {
  isDark: boolean;
  onToggle: () => void;
  reduceMotion: boolean;
}) {
  const x = useSharedValue(isDark ? 28 : 0);
  useEffect(() => {
    x.value = withSpring(isDark ? 28 : 0, motion.press);
  }, [isDark, x]);

  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onPress={onToggle}
      style={[
        styles.toggle,
        {
          backgroundColor: isDark ? '#3A3550' : '#FFF1DE',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#F6DFC0',
        },
      ]}
    >
      <Animated.View style={[styles.toggleKnob, knob]}>
        <Text style={styles.toggleFace}>{isDark ? '🌚' : '🌞'}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.title, fontSize: 17 },
  wordmark: {
    marginLeft: spacing.sm,
  },
  libraryBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: {
    width: 64,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 3,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleFace: { fontSize: 18, lineHeight: 22 },
});
