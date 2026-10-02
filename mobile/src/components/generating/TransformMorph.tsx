/**
 * Trace → Morph → Inflate → Material
 *
 * RN-native morph: progressive stroke reveal, point-space interpolation to
 * cleaned geometry, volume inflation, then material resolve + result handoff.
 * No geometric backdrop plates — object only against transparent stage.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Image,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  MORPH_PHASES,
  chaikin,
  clamp01,
  easeInOut,
  easeOutCubic,
  fitStrokesToBox,
  lerp,
  lerpPoints,
  resampleEven,
  toSvgPath,
} from '../../lib/morph';
import type { DoodleStroke, StyleId } from '../../models/types';
import { transformDebug } from '../../lib/transformDebug';

const SAMPLES = 64;

interface Props {
  strokes: DoodleStroke[];
  styleId: StyleId;
  resultUri?: string | null;
  providerReady?: boolean;
  reducedMotion?: boolean;
}

interface Pair {
  id: string;
  color: string;
  closed: boolean;
  dot: boolean;
  from: { x: number; y: number }[];
  to: { x: number; y: number }[];
  rawWidth: number;
  width: number;
}

export function TransformMorph({
  strokes,
  styleId,
  resultUri,
  providerReady,
  reducedMotion: reducedProp,
}: Props) {
  const { width: winW } = useWindowDimensions();
  const size = Math.min(300, winW - 64);
  const [reduced, setReduced] = useState(!!reducedProp);
  const [elapsed, setElapsed] = useState(reducedProp ? MORPH_PHASES.settled : 0);
  const breathe = useSharedValue(1);
  const providerReadyRef = useRef(Boolean(providerReady));
  providerReadyRef.current = Boolean(providerReady);
  const lastPhaseRef = useRef<string>('');
  const mountedLogged = useRef(false);

  // Stable stroke identity for clock — content hash, not array reference.
  const strokeKey = useMemo(
    () =>
      strokes
        .map(
          (s) =>
            `${s.id}:${s.points.length}:${s.color}:${s.width}:${s.closed ? 1 : 0}`,
        )
        .join('|'),
    [strokes],
  );

  useEffect(() => {
    if (!mountedLogged.current) {
      mountedLogged.current = true;
      transformDebug('TransformMorph-mounted', {
        styleId,
        strokeKey: strokeKey.slice(0, 60),
        providerReady: Boolean(providerReady),
        resultUri: resultUri ? String(resultUri).slice(0, 60) : null,
        reduced: !!reducedProp,
      });
    }
    return () => {
      transformDebug('TransformMorph-unmounted', {
        lastPhase: lastPhaseRef.current,
        elapsedLast: lastPhaseRef.current,
      });
    };
    // mount/unmount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    transformDebug('TransformMorph-props', {
      providerReady: Boolean(providerReady),
      resultUri: resultUri ? String(resultUri).slice(0, 60) : null,
      strokeKey: strokeKey.slice(0, 60),
      reduced,
    });
  }, [providerReady, resultUri, strokeKey, reduced]);

  useEffect(() => {
    if (reducedProp !== undefined) {
      setReduced(!!reducedProp);
      return;
    }
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );
    return () => sub.remove();
  }, [reducedProp]);

  /**
   * Phase clock — must NOT restart when providerReady flips.
   * Restarting mid-Morph was stranding the visual sequence / looking "stuck".
   * providerReady only gently accelerates remaining time toward settled.
   */
  useEffect(() => {
    transformDebug('clock-effect-start', {
      reduced,
      strokeKey: strokeKey.slice(0, 60),
      providerReady: providerReadyRef.current,
    });
    if (reduced) {
      setElapsed(MORPH_PHASES.settled);
      transformDebug('phase', {
        phase: 'settled',
        elapsed: MORPH_PHASES.settled,
        reduced: true,
      });
      return;
    }
    const start = Date.now();
    let raf = 0;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const wall = (Date.now() - start) / 1000;
      // Gentle catch-up only — never reset phase progress.
      const ready = providerReadyRef.current;
      const boost =
        ready && wall < MORPH_PHASES.settled
          ? 1 + (MORPH_PHASES.settled - wall) * 0.12
          : 1;
      const next = Math.min(MORPH_PHASES.settled + 8, wall * boost);
      setElapsed(next);
      if (next < MORPH_PHASES.settled + 4) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      transformDebug('clock-effect-cleanup', {
        strokeKey: strokeKey.slice(0, 60),
      });
    };
  }, [reduced, strokeKey]);

  useEffect(() => {
    if (reduced) {
      breathe.value = 1;
      return;
    }
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.028, {
          duration: 780,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0.985, {
          duration: 780,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      true,
    );
  }, [reduced, breathe]);

  const pairs = useMemo<Pair[]>(() => {
    const fitted = fitStrokesToBox(
      strokes.map((s) => ({
        id: s.id,
        color: s.color,
        width: s.width,
        points: s.points,
        closed: Boolean(s.closed),
      })),
    );
    return fitted.map((s) => {
      const len = pathLen(s.points);
      const isDot = len < 14 || s.points.length < 3;
      const gap =
        s.points.length > 1
          ? Math.hypot(
              s.points[0]!.x - s.points[s.points.length - 1]!.x,
              s.points[0]!.y - s.points[s.points.length - 1]!.y,
            )
          : 0;
      const closed =
        !isDot &&
        (Boolean(s.closed) || (len > 90 && gap < Math.max(28, len * 0.15)));
      const shaped = isDot
        ? [s.points[0]!]
        : chaikin(resampleLoose(s.points), closed, 3);
      return {
        id: s.id,
        color: s.color,
        closed,
        dot: isDot,
        from: isDot
          ? [s.points[0]!]
          : resampleEven(s.points, SAMPLES, false),
        to: isDot
          ? shaped
          : resampleEven(shaped, SAMPLES, closed),
        rawWidth: Math.max(2, s.width),
        width: Math.max(14, Math.min(36, 11 + s.width * 1.15)),
      };
    });
  }, [strokes]);

  // Trace 0–0.6 · Morph 0.55–1.15 · Inflate 1.1–1.65 · Material 1.6–2.3 · settled 2.5
  const e = elapsed;

  // Derive named phase from elapsed for diagnostics (does not drive nav).
  const namedPhase =
    e < 0.55
      ? 'trace'
      : e < 1.1
        ? 'morph'
        : e < 1.6
          ? 'inflate'
          : e < MORPH_PHASES.settled
            ? 'material'
            : 'complete';

  if (namedPhase !== lastPhaseRef.current) {
    lastPhaseRef.current = namedPhase;
    transformDebug('phase', {
      phase: namedPhase,
      elapsed: Number(e.toFixed(3)),
      reduced,
      strokeKey: strokeKey.slice(0, 40),
      providerReady: Boolean(providerReady),
      resultUri: resultUri ? String(resultUri).slice(0, 40) : null,
      waiting: e >= MORPH_PHASES.settled && !resultUri,
    });
  }

  const morphT = reduced ? 1 : easeInOut(clamp01((e - 0.55) / 0.6));
  const inflateT = reduced ? 1 : easeOutCubic(clamp01((e - 1.1) / 0.55));
  const materialT = reduced ? 1 : easeOutCubic(clamp01((e - 1.6) / 0.55));
  const waiting = e >= MORPH_PHASES.settled && !resultUri;
  const settledMaterial = materialT > 0.82;
  const inflatePuff = reduced ? 1 : 1 + 0.07 * Math.sin(Math.PI * inflateT);
  const styleLook = STYLE_LOOK[styleId];

  const waitStyle = useAnimatedStyle(() => {
    const jiggle = waiting && !reduced ? 0.012 * Math.sin(Date.now() / 240) : 0;
    const waitBreath = waiting && !reduced ? breathe.value : 1;
    return {
      transform: [
        { scaleX: inflatePuff * (1 + jiggle) * waitBreath },
        { scaleY: inflatePuff * (1 - jiggle) * waitBreath },
      ],
    };
  });

  // Result image only after Material is well underway — motion gate stays in AppContext.
  const imageOpacity =
    resultUri && settledMaterial
      ? easeOutCubic(clamp01((materialT - 0.5) / 0.5))
      : 0;
  const strokeFade = 1 - imageOpacity * 0.98;

  return (
    <Animated.View
      style={[{ width: size, height: size, backgroundColor: 'transparent' }, waitStyle]}
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 400 400"
        style={[StyleSheet.absoluteFill, { opacity: strokeFade }]}
      >
        {pairs.map((pair, i) => {
          const trace = reduced
            ? 1
            : easeOutCubic(clamp01((e - i * 0.07) / 0.6));
          const visibleFrom = slicePoints(pair.from, Math.max(0.02, trace));
          const boilAmp = reduced ? 0 : (1 - morphT) * 2.2;
          const boiled = boilPoints(visibleFrom, e, i, boilAmp);
          const destSlice = slicePoints(pair.to, 1);
          const morphed = lerpPoints(
            padTo(boiled, destSlice.length),
            destSlice,
            morphT,
          );
          // Inflate: volume via stroke weight; Material: style thickness + slight color lift
          const width = lerp(
            pair.rawWidth,
            pair.width * styleLook.thickness,
            Math.max(morphT * 0.35, inflateT),
          );
          const fillOp =
            pair.closed
              ? inflateT * 0.88 * (0.55 + 0.45 * materialT)
              : 0;
          const strokeColor =
            materialT > 0.05
              ? mixHex(pair.color, styleLook.tint, materialT * 0.35)
              : pair.color;
          const d = toSvgPath(morphed, pair.closed && morphT > 0.55);

          if (pair.dot) {
            const p = morphed[0] ?? pair.to[0]!;
            const r =
              lerp(pair.rawWidth / 2, pair.width * 0.75, inflateT) * trace;
            return (
              <Circle
                key={pair.id}
                cx={p.x}
                cy={p.y}
                r={r}
                fill={strokeColor}
                opacity={strokeFade}
              />
            );
          }

          return (
            <Path
              key={pair.id}
              d={d}
              fill={pair.closed ? strokeColor : 'none'}
              fillOpacity={fillOp * strokeFade}
              stroke={strokeColor}
              strokeWidth={width}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={strokeFade}
            />
          );
        })}
      </Svg>

      {resultUri && imageOpacity > 0.02 ? (
        <Image
          source={{ uri: resultUri }}
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: imageOpacity,
              transform: [{ scale: lerp(0.94, 1, imageOpacity) }],
            },
          ]}
          resizeMode="contain"
        />
      ) : null}
    </Animated.View>
  );
}

function pathLen(points: { x: number; y: number }[]): number {
  let t = 0;
  for (let i = 1; i < points.length; i++) {
    t += Math.hypot(
      points[i]!.x - points[i - 1]!.x,
      points[i]!.y - points[i - 1]!.y,
    );
  }
  return t;
}

function resampleLoose(points: { x: number; y: number }[]) {
  if (points.length < 3) return points;
  const out = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1]!;
    if (Math.hypot(points[i]!.x - prev.x, points[i]!.y - prev.y) >= 8) {
      out.push(points[i]!);
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

function slicePoints(
  points: { x: number; y: number }[],
  t: number,
): { x: number; y: number }[] {
  if (points.length <= 1) return points;
  const n = Math.max(2, Math.ceil(points.length * clamp01(t)));
  return points.slice(0, n);
}

function padTo(
  points: { x: number; y: number }[],
  n: number,
): { x: number; y: number }[] {
  if (points.length >= n) return points.slice(0, n);
  if (!points.length) {
    return Array.from({ length: n }, () => ({ x: 200, y: 200 }));
  }
  const last = points[points.length - 1]!;
  return [...points, ...Array.from({ length: n - points.length }, () => last)];
}

function boilPoints(
  points: { x: number; y: number }[],
  e: number,
  seed: number,
  amp: number,
): { x: number; y: number }[] {
  if (amp < 0.05) return points;
  return points.map((p, i) => ({
    x: p.x + Math.sin(e * 11 + i * 0.7 + seed) * amp,
    y: p.y + Math.cos(e * 9.5 + i * 0.55 + seed * 1.3) * amp,
  }));
}

/** Soft channel mix for late material tint without a plate/backdrop. */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return a;
  const m = (x: number, y: number) => Math.round(lerp(x, y, clamp01(t)));
  return `rgb(${m(pa[0], pb[0])},${m(pa[1], pb[1])},${m(pa[2], pb[2])})`;
}

function parseHex(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '').trim();
  if (h.length === 3) {
    return [
      parseInt(h[0]! + h[0]!, 16),
      parseInt(h[1]! + h[1]!, 16),
      parseInt(h[2]! + h[2]!, 16),
    ];
  }
  if (h.length !== 6) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const STYLE_LOOK: Record<StyleId, { tint: string; thickness: number }> = {
  gummy: { tint: '#FF4D8D', thickness: 1.12 },
  clay: { tint: '#E0A57A', thickness: 1.0 },
  plush: { tint: '#9B59F0', thickness: 1.18 },
  glossy: { tint: '#FF6A2A', thickness: 1.02 },
};
