/**
 * Preview 2×2 material grid — stable cards, floating orbs.
 */
import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../design/theme';
import { motion, radius, spacing, type } from '../design/tokens';
import { STYLES, type StyleId } from '../models/types';
import { StyleOrb } from './StyleOrb';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  onSelect: (style: StyleId) => void;
  disabled?: boolean;
}

export function StyleMaterialGrid({ onSelect, disabled }: Props) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const gapX = spacing.lg;
  const gapY = spacing.xxl;
  const sidePad = spacing.lg * 2;
  const tileW = Math.min(148, (width - sidePad - gapX) / 2);

  return (
    <View style={[styles.grid, { columnGap: gapX, rowGap: gapY }]}>
      {STYLES.map((s, i) => (
        <MaterialTile
          key={s.id}
          styleId={s.id}
          label={s.label}
          width={tileW}
          index={i}
          disabled={disabled}
          backgroundColor={colors.styleTile}
          labelColor={colors.ink}
          onPress={() => onSelect(s.id)}
        />
      ))}
    </View>
  );
}

function MaterialTile({
  styleId,
  label,
  width,
  index,
  disabled,
  backgroundColor,
  labelColor,
  onPress,
}: {
  styleId: StyleId;
  label: string;
  width: number;
  index: number;
  disabled?: boolean;
  backgroundColor: string;
  labelColor: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const floatY = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const pressAnim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const floatAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));
  const orbSize = Math.min(112, width * 0.78);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      floatY.value = 0;
      return;
    }
    const amp = 4 + (index % 2) * 1.5;
    const duration = 2800 + index * 320;
    floatY.value = withRepeat(
      withSequence(
        withTiming(-amp, {
          duration: duration / 2,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(amp * 0.35, {
          duration: duration / 2,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      true,
    );
  }, [reduceMotion, floatY, index]);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${label} style — generate this style`}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.95, motion.press);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring);
      }}
      style={[
        styles.tileWrap,
        { width, opacity: disabled ? 0.5 : 1 },
        pressAnim,
      ]}
    >
      <View style={[styles.card, { backgroundColor, height: width * 0.72 }]}>
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      </View>
      <Animated.View
        pointerEvents="none"
        style={[styles.orbFloat, { width: orbSize, height: orbSize }, floatAnim]}
      >
        <StyleOrb styleId={styleId} size={orbSize} />
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 320,
    alignSelf: 'center',
  },
  tileWrap: {
    alignItems: 'center',
    paddingTop: 36,
  },
  card: {
    width: '100%',
    borderRadius: radius.tile,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.md,
  },
  orbFloat: {
    position: 'absolute',
    top: 0,
  },
  label: {
    ...type.styleLabel,
    textAlign: 'center',
  },
});
