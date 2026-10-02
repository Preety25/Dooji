/**
 * Result "Change style" tiles — orb + label + generated/current/staged states.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';

import { useTheme } from '../design/theme';
import { motion, radius, spacing, type } from '../design/tokens';
import { lookupCachedAsset } from '../generation/cache';
import { STYLES, type StyleId } from '../models/types';
import { useApp } from '../state/AppContext';
import { StyleOrb } from './StyleOrb';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  selected?: StyleId;
  disabled?: boolean;
  onSelect: (style: StyleId) => void;
}

export function StyleSelector({ selected, disabled, onSelect }: Props) {
  const app = useApp();
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      {STYLES.map((s) => {
        const generated = Boolean(lookupCachedAsset(app.creation, s.id));
        const current = selected === s.id && generated;
        const staged = selected === s.id && !generated;
        return (
          <StyleTile
            key={s.id}
            styleId={s.id}
            label={s.label}
            current={current}
            staged={staged}
            generated={generated}
            disabled={disabled}
            accent={colors.accent}
            accentSoft={colors.accentSoft}
            sunken={colors.styleTile}
            ink={colors.ink}
            muted={colors.muted}
            checkIdleBg={colors.checkmarkIdleBg}
            checkIdleIcon={colors.checkmarkIdleIcon}
            onPress={() => onSelect(s.id)}
          />
        );
      })}
    </View>
  );
}

function StyleTile({
  styleId,
  label,
  current,
  staged,
  generated,
  disabled,
  accent,
  accentSoft,
  sunken,
  ink,
  muted,
  checkIdleBg,
  checkIdleIcon,
  onPress,
}: {
  styleId: StyleId;
  label: string;
  current: boolean;
  staged: boolean;
  generated: boolean;
  disabled?: boolean;
  accent: string;
  accentSoft: string;
  sunken: string;
  ink: string;
  muted: string;
  checkIdleBg: string;
  checkIdleIcon: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const emphasized = current || staged;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={
        generated
          ? `${label} style — show generated version`
          : `${label} style — generate this style`
      }
      accessibilityState={{ selected: emphasized }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.92, motion.press);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring);
      }}
      style={[styles.tile, anim]}
    >
      <View
        style={[
          styles.orbBox,
          {
            backgroundColor: emphasized ? accentSoft : sunken,
            borderColor: current ? accent : staged ? accent : 'transparent',
            borderStyle: staged ? 'dashed' : 'solid',
            borderWidth: current || staged ? 1.5 : 0,
          },
        ]}
      >
        <StyleOrb styleId={styleId} size={52} />
        {(current || generated) && (
          <View
            style={[
              styles.check,
              {
                backgroundColor: current ? accent : checkIdleBg,
                borderColor: accent,
              },
            ]}
          >
            <MaterialIcons
              name="check"
              size={12}
              color={current ? '#FFFFFF' : checkIdleIcon}
            />
          </View>
        )}
      </View>
      <Text
        style={[
          styles.label,
          {
            color: emphasized ? ink : muted,
            fontFamily: emphasized ? 'Figtree_600SemiBold' : 'Figtree_400Regular',
          },
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  orbBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  label: {
    ...type.caption,
    fontSize: 13,
  },
});
