import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

import { useTheme } from '../design/theme';
import {
  brushSizes,
  brushSwatchShadow,
  motion,
  radius,
  spacing,
  type,
} from '../design/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  tool: 'brush' | 'eraser';
  color: string;
  size: number;
  colors: string[];
  canUndo: boolean;
  canRedo: boolean;
  hasStrokes: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onTool: (t: 'brush' | 'eraser') => void;
  onColor: (c: string) => void;
  onSize: (n: number) => void;
  onClear: () => void;
  onMakeIt: () => void;
}

const DOT = [8, 12, 16];

export function CanvasToolbar(props: Props) {
  const { colors } = useTheme();
  const makeActive = props.hasStrokes;

  return (
    <View style={styles.wrap}>
      <View style={styles.palette} accessibilityRole="radiogroup">
        {props.colors.map((c) => {
          const active = props.color.toLowerCase() === c.toLowerCase();
          const light = c.toLowerCase() === '#ffffff';
          const shadow = active ? brushSwatchShadow(c) : null;
          return (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Color ${c}`}
              onPress={() => {
                props.onColor(c);
                props.onTool('brush');
              }}
              style={styles.swatchHit}
            >
              <View
                style={[
                  styles.swatch,
                  {
                    width: active ? 36 : 24,
                    height: active ? 36 : 24,
                    borderRadius: 99,
                    backgroundColor: c,
                    borderWidth: light ? 1 : 0,
                    borderColor: colors.border,
                    ...(shadow || {
                      shadowOpacity: 0,
                      elevation: 0,
                    }),
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.toolbar,
          {
            backgroundColor: colors.toolbarBg,
            borderColor: colors.toolbarBorder,
          },
        ]}
      >
        <IconBtn
          name="undo"
          accessibilityLabel="Undo"
          disabled={!props.canUndo}
          color={colors.ink}
          muted={colors.hint}
          onPress={props.onUndo}
        />
        <IconBtn
          name="redo"
          accessibilityLabel="Redo"
          disabled={!props.canRedo}
          color={colors.ink}
          muted={colors.hint}
          onPress={props.onRedo}
        />
        <View style={[styles.divider, { backgroundColor: colors.toolbarDivider }]} />
        <ToolCircle
          active={props.tool === 'brush'}
          onPress={() => props.onTool('brush')}
          accessibilityLabel="Pen"
          activeBg={colors.controlSelectedBg}
          activeFg={colors.controlSelectedFg}
          ink={colors.ink}
          icon="edit"
        />
        <ToolCircle
          active={props.tool === 'eraser'}
          onPress={() => props.onTool('eraser')}
          accessibilityLabel="Eraser"
          activeBg={colors.controlSelectedBg}
          activeFg={colors.controlSelectedFg}
          ink={colors.ink}
          iconSet="community"
          icon="eraser"
        />
        <View style={styles.sizes} accessibilityRole="radiogroup">
          {brushSizes.map((n, i) => {
            const active = props.size === n && props.tool === 'brush';
            return (
              <Pressable
                key={n}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Brush size ${n}`}
                onPress={() => {
                  props.onSize(n);
                  props.onTool('brush');
                }}
                hitSlop={8}
                style={styles.sizeHit}
              >
                <View
                  style={{
                    width: DOT[i],
                    height: DOT[i],
                    borderRadius: 99,
                    backgroundColor: active
                      ? colors.controlSelectedBg
                      : colors.hint,
                  }}
                />
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.divider, { backgroundColor: colors.toolbarDivider }]} />
        <IconBtn
          name="delete-outline"
          accessibilityLabel="Clear canvas"
          disabled={!props.hasStrokes}
          color={colors.danger}
          muted={colors.hint}
          onPress={props.onClear}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Make it"
        disabled={!makeActive}
        onPress={props.onMakeIt}
        style={[
          styles.makeIt,
          {
            backgroundColor: makeActive
              ? colors.makeItActive
              : colors.makeItMuted,
          },
        ]}
      >
        <Text
          style={[
            styles.makeItText,
            {
              color: makeActive
                ? colors.makeItActiveText
                : colors.makeItMutedText,
            },
          ]}
        >
          Make it{' '}
        </Text>
        <MaterialIcons
          name="auto-awesome"
          size={18}
          color={
            makeActive ? colors.makeItActiveIcon : colors.makeItMutedText
          }
        />
      </Pressable>
    </View>
  );
}

function IconBtn({
  name,
  accessibilityLabel,
  disabled,
  color,
  muted,
  onPress,
}: {
  name: React.ComponentProps<typeof MaterialIcons>['name'];
  accessibilityLabel: string;
  disabled?: boolean;
  color: string;
  muted: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={styles.iconBtn}
    >
      <MaterialIcons
        name={name}
        size={22}
        color={disabled ? muted : color}
        style={{ opacity: disabled ? 0.45 : 1 }}
      />
    </Pressable>
  );
}

function ToolCircle({
  active,
  onPress,
  accessibilityLabel,
  activeBg,
  activeFg,
  ink,
  icon,
  iconSet = 'material',
}: {
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  activeBg: string;
  activeFg: string;
  ink: string;
  icon: string;
  iconSet?: 'material' | 'community';
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const color = active ? activeFg : ink;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.86, motion.press);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.press);
      }}
      style={[
        styles.toolCircle,
        { backgroundColor: active ? activeBg : 'transparent' },
        anim,
      ]}
    >
      {iconSet === 'community' ? (
        <MaterialCommunityIcons name={icon as 'eraser'} size={20} color={color} />
      ) : (
        <MaterialIcons
          name={icon as React.ComponentProps<typeof MaterialIcons>['name']}
          size={20}
          color={color}
        />
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  palette: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  swatchHit: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {},
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: spacing.toolbar,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1.5,
    height: 24,
    borderRadius: 99,
    marginHorizontal: 2,
  },
  toolCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizes: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  sizeHit: {
    width: 28,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  makeIt: {
    minHeight: spacing.makeIt,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  makeItText: {
    ...type.button,
    fontSize: 16,
  },
});
