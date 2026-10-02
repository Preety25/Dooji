import React, { useEffect, useId, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, G, Mask, Path, Rect } from 'react-native-svg';
import {
  BOIL_MS,
  ERASE,
  HOLD,
  NEXT_GAP,
  STROKE_GAP,
  SKETCH_SUNNY,
  TILTS,
  doodleDrawTime,
  sketchbookDoodles,
  type SketchAccent,
  type SketchDoodle,
} from '../../data/sketchbookDoodles';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Normalized dash length — long enough for any doodle stroke in the 200 viewBox. */
const DASH = 420;
/** Longer dash for the zigzag eraser sweep. */
const ERASE_DASH = 1800;

const SIZE = 168;
const ERASE_PATH =
  'M14 30 L186 44 L12 72 L188 92 L12 118 L188 136 L14 160 L188 178 L24 198';
const DASH_PATH = 'M-8 0.6 C-3 -0.4 3 0.5 8 -0.4';
const SPARKLE_PATH =
  'M0 -11 C1.4 -3.2 3.6 -1.1 11 0.3 C3.4 1.3 1.1 3.6 -0.3 11 C-1.3 3.4 -3.7 1.2 -11 -0.2 C-3.4 -1.3 -1.2 -3.6 0 -11 Z';

/** Tiny deterministic graphite edge offsets — cycles instead of SVG turbulence. */
const BOIL_OFFSETS = [
  { x: 0, y: 0, w: 0 },
  { x: 0.35, y: -0.25, w: 0.12 },
  { x: -0.28, y: 0.3, w: -0.08 },
  { x: 0.2, y: 0.18, w: 0.06 },
] as const;

type Palette = {
  ink: string;
  accent: string;
  sunny: string;
};

type Props = {
  ink: string;
  accent: string;
  sunny?: string;
  reduceMotion: boolean;
  size?: number;
};

/** Empty-canvas sketchbook: pencil doodles stroke-by-stroke, hold, rough erase, next. */
export function SketchbookLoop({
  ink,
  accent,
  sunny = SKETCH_SUNNY.light,
  reduceMotion,
  size = SIZE,
}: Props) {
  const [index, setIndex] = useState(0);
  const palette: Palette = { ink, accent, sunny };

  if (reduceMotion) {
    return (
      <View style={[styles.host, { width: size, height: size }]} accessibilityElementsHidden>
        <StaticSketch doodle={sketchbookDoodles[0]} tilt={TILTS[0]} palette={palette} size={size} />
      </View>
    );
  }

  return (
    <View style={[styles.host, { width: size, height: size }]} accessibilityElementsHidden>
      <SketchCycle
        key={index}
        doodle={sketchbookDoodles[index]}
        tilt={TILTS[index % TILTS.length]}
        palette={palette}
        size={size}
        onDone={() => setIndex((i) => (i + 1) % sketchbookDoodles.length)}
      />
    </View>
  );
}

function StaticSketch({
  doodle,
  tilt,
  palette,
  size,
}: {
  doodle: SketchDoodle;
  tilt: number;
  palette: Palette;
  size: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" style={{ transform: [{ rotate: `${tilt}deg` }] }}>
      <DoodleStrokes doodle={doodle} animate={false} palette={palette} boil={0} drawTime={0} />
    </Svg>
  );
}

function SketchCycle({
  doodle,
  tilt,
  palette,
  size,
  onDone,
}: {
  doodle: SketchDoodle;
  tilt: number;
  palette: Palette;
  size: number;
  onDone: () => void;
}) {
  const uid = useId().replace(/:/g, '');
  const drawTime = useMemo(() => doodleDrawTime(doodle), [doodle]);
  const [boil, setBoil] = useState(0);
  const eraseProgress = useSharedValue(0);
  const rotate = useSharedValue(tilt * 0.4);
  const scale = useSharedValue(0.97);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 400, easing: Easing.bezier(0.23, 1, 0.32, 1) });
    rotate.value = withTiming(tilt, {
      duration: (drawTime + HOLD) * 1000 * 0.18,
      easing: Easing.inOut(Easing.quad),
    });
    const sway = setTimeout(() => {
      rotate.value = withTiming(tilt - 1.2, {
        duration: (drawTime + HOLD) * 1000 * 0.47,
        easing: Easing.inOut(Easing.quad),
      });
    }, (drawTime + HOLD) * 1000 * 0.18);
    const settle = setTimeout(() => {
      rotate.value = withTiming(tilt, {
        duration: (drawTime + HOLD) * 1000 * 0.35,
        easing: Easing.inOut(Easing.quad),
      });
    }, (drawTime + HOLD) * 1000 * 0.65);

    const toErase = setTimeout(() => {
      eraseProgress.value = withTiming(1, {
        duration: ERASE * 1000,
        easing: Easing.bezier(0.45, 0, 0.55, 1),
      });
    }, (drawTime + HOLD) * 1000);

    const toNext = setTimeout(onDone, (drawTime + HOLD + ERASE + NEXT_GAP) * 1000);
    const boilTimer = setInterval(() => setBoil((s) => (s + 1) % BOIL_OFFSETS.length), BOIL_MS);

    return () => {
      clearTimeout(sway);
      clearTimeout(settle);
      clearTimeout(toErase);
      clearTimeout(toNext);
      clearInterval(boilTimer);
      cancelAnimation(eraseProgress);
      cancelAnimation(rotate);
      cancelAnimation(scale);
    };
    // One timeline per doodle instance (keyed by parent).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }, { scale: scale.value }],
  }));

  const eraseProps = useAnimatedProps(() => ({
    strokeDashoffset: ERASE_DASH * (1 - eraseProgress.value),
  }));

  const maskId = `erase-${uid}`;

  return (
    <Animated.View style={[styles.fill, shellStyle]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <Mask id={maskId} x={-20} y={-20} width={240} height={240} maskUnits="userSpaceOnUse">
            <Rect x={-20} y={-20} width={240} height={240} fill="white" />
            <AnimatedPath
              d={ERASE_PATH}
              fill="none"
              stroke="black"
              strokeWidth={48}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${ERASE_DASH} ${ERASE_DASH}`}
              strokeDashoffset={ERASE_DASH}
              animatedProps={eraseProps}
            />
          </Mask>
        </Defs>
        <G mask={`url(#${maskId})`}>
          <DoodleStrokes doodle={doodle} animate palette={palette} boil={boil} drawTime={drawTime} />
        </G>
      </Svg>
    </Animated.View>
  );
}

function DoodleStrokes({
  doodle,
  animate,
  palette,
  boil,
  drawTime,
}: {
  doodle: SketchDoodle;
  animate: boolean;
  palette: Palette;
  boil: number;
  drawTime: number;
}) {
  const timed = useMemo(() => {
    let delay = 0.05;
    return doodle.strokes.map((s) => {
      const start = delay;
      delay += s.t + STROKE_GAP;
      return { ...s, start };
    });
  }, [doodle]);

  const off = BOIL_OFFSETS[boil % BOIL_OFFSETS.length];

  return (
    <G transform={`translate(${off.x} ${off.y})`}>
      {timed.map((s, i) => (
        <G key={i}>
          <DrawPath
            d={s.d}
            animate={animate}
            delay={s.start}
            duration={s.t}
            stroke={palette.ink}
            strokeOpacity={0.72}
            strokeWidth={3.2 + off.w}
            dashLen={Math.max(48, Math.round(s.t * 260))}
          />
          {s.t > 0.3 ? (
            <G transform="translate(1.3 -0.9) rotate(0.6 100 100)">
              <DrawPath
                d={s.d}
                animate={animate}
                delay={s.start + s.t * 0.35}
                duration={s.t * 0.75}
                stroke={palette.ink}
                strokeOpacity={0.28}
                strokeWidth={1.55}
                dashLen={Math.max(48, Math.round(s.t * 260))}
              />
            </G>
          ) : null}
        </G>
      ))}
      {doodle.accents.map((a, i) => (
        <Accent
          key={i}
          accent={a}
          animate={animate}
          delay={drawTime * 0.6 + i * 0.12}
          palette={palette}
        />
      ))}
    </G>
  );
}

function DrawPath({
  d,
  animate,
  delay,
  duration,
  stroke,
  strokeOpacity,
  strokeWidth,
  dashLen = DASH,
}: {
  d: string;
  animate: boolean;
  delay: number;
  duration: number;
  stroke: string;
  strokeOpacity: number;
  strokeWidth: number;
  dashLen?: number;
}) {
  const progress = useSharedValue(animate ? 0 : 1);
  const opacity = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) {
      progress.value = 1;
      opacity.value = 1;
      return;
    }
    opacity.value = withDelay(delay * 1000, withTiming(1, { duration: 16 }));
    progress.value = withDelay(
      delay * 1000,
      withTiming(1, { duration: duration * 1000, easing: Easing.bezier(0.4, 0, 0.3, 1) }),
    );
    return () => {
      cancelAnimation(progress);
      cancelAnimation(opacity);
    };
  }, [animate, delay, duration, opacity, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: dashLen * (1 - progress.value),
    opacity: opacity.value * strokeOpacity,
  }));

  if (!animate) {
    return (
      <Path
        d={d}
        fill="none"
        stroke={stroke}
        strokeOpacity={strokeOpacity}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={`${dashLen} ${dashLen}`}
      strokeDashoffset={dashLen}
      animatedProps={animatedProps}
    />
  );
}

function Accent({
  accent,
  animate,
  delay,
  palette,
}: {
  accent: SketchAccent;
  animate: boolean;
  delay: number;
  palette: Palette;
}) {
  const color = accent.tone === 'sunny' ? palette.sunny : palette.accent;
  const progress = useSharedValue(animate ? 0 : 1);
  const opacity = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) return;
    opacity.value = withDelay(delay * 1000, withTiming(1, { duration: 180 }));
    if (accent.kind === 'dash') {
      progress.value = withDelay(
        delay * 1000,
        withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }),
      );
    }
    return () => {
      cancelAnimation(progress);
      cancelAnimation(opacity);
    };
  }, [accent.kind, animate, delay, opacity, progress]);

  const dashProps = useAnimatedProps(() => ({
    strokeDashoffset: 28 * (1 - progress.value),
    opacity: opacity.value * 0.7,
  }));

  const sparkleStyle = useAnimatedProps(() => ({
    opacity: opacity.value * 0.7,
  }));

  if (accent.kind === 'dash') {
    return (
      <G transform={`translate(${accent.x} ${accent.y}) rotate(${accent.r})`}>
        {animate ? (
          <AnimatedPath
            d={DASH_PATH}
            fill="none"
            stroke={color}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeDasharray="28 28"
            strokeDashoffset={28}
            animatedProps={dashProps}
          />
        ) : (
          <Path
            d={DASH_PATH}
            fill="none"
            stroke={color}
            strokeWidth={2.8}
            strokeOpacity={0.7}
            strokeLinecap="round"
          />
        )}
      </G>
    );
  }

  return (
    <G transform={`translate(${accent.x} ${accent.y}) scale(${accent.r})`}>
      {animate ? (
        <AnimatedPath
          d={SPARKLE_PATH}
          fill="none"
          stroke={color}
          strokeWidth={2.1}
          strokeLinejoin="round"
          animatedProps={sparkleStyle}
        />
      ) : (
        <Path
          d={SPARKLE_PATH}
          fill="none"
          stroke={color}
          strokeWidth={2.1}
          strokeOpacity={0.7}
          strokeLinejoin="round"
        />
      )}
    </G>
  );
}

const styles = StyleSheet.create({
  host: { marginBottom: 8 },
  fill: { width: '100%', height: '100%' },
});
