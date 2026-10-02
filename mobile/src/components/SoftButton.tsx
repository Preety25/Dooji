import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '../design/theme';
import { motion, radius, spacing, type } from '../design/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'ink' | 'sheetSecondary';
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  icon?: ReactNode;
  /** Optional label color override (e.g. Library Delete → #FB4A52). */
  labelColor?: string;
}

export function SoftButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
  accessibilityLabel,
  icon,
  labelColor,
}: Props) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  let bg = 'transparent';
  let fg = colors.ink;
  let border: { borderWidth: number; borderColor: string } | undefined;

  if (variant === 'primary') {
    bg = colors.accent;
    fg = '#FFFFFF';
  } else if (variant === 'ink') {
    // Sheet primary (Save and leave) — theme-aware high contrast.
    bg = colors.sheetPrimaryBg;
    fg = colors.sheetPrimaryText;
  } else if (variant === 'sheetSecondary') {
    bg = colors.sheetSecondaryBg;
    fg = colors.sheetSecondaryText;
    if (colors.sheetSecondaryBorder !== 'transparent') {
      border = { borderWidth: 1, borderColor: colors.sheetSecondaryBorder };
    }
  } else if (variant === 'secondary') {
    bg = colors.btnSecondaryBg;
    fg = colors.btnSecondaryText;
    border = { borderWidth: 1, borderColor: colors.btnSecondaryBorder };
  } else if (variant === 'danger') {
    bg = colors.dangerSoft;
    fg = colors.danger;
  } else if (variant === 'ghost') {
    border = { borderWidth: 1, borderColor: colors.border };
    fg = colors.ink;
  }
  if (labelColor) fg = labelColor;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.96, motion.press);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.press);
      }}
      style={[
        styles.base,
        { backgroundColor: bg, opacity: disabled ? 0.4 : 1 },
        border,
        anim,
        style,
      ]}
    >
      <View style={styles.inner}>
        {icon}
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...type.button,
  },
});
