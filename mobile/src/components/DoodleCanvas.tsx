import React, { useCallback, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { runOnJS } from 'react-native-reanimated';

import { colors } from '../design/tokens';
import { newId } from '../lib/id';
import { strokesToSvgPath } from '../lib/strokes';
import type { DoodleStroke } from '../models/types';

interface Props {
  strokes: DoodleStroke[];
  color: string;
  size: number;
  tool: 'brush' | 'eraser';
  onStrokeEnd: (stroke: DoodleStroke) => void;
  onLayoutSize?: (size: { width: number; height: number }) => void;
  enabled?: boolean;
}

export function DoodleCanvas({
  strokes,
  color,
  size,
  tool,
  onStrokeEnd,
  onLayoutSize,
  enabled = true,
}: Props) {
  const [sizeBox, setSizeBox] = useState({ width: 1, height: 1 });
  const [live, setLive] = useState<DoodleStroke | null>(null);
  const liveRef = useRef<DoodleStroke | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSizeBox({ width, height });
    onLayoutSize?.({ width, height });
  };

  const begin = useCallback(
    (x: number, y: number) => {
      const stroke: DoodleStroke = {
        id: newId('stroke'),
        points: [{ x, y }],
        color: tool === 'eraser' ? colors.canvas : color,
        width: tool === 'eraser' ? size * 2.2 : size,
        tool,
      };
      liveRef.current = stroke;
      setLive(stroke);
    },
    [color, size, tool],
  );

  const move = useCallback((x: number, y: number) => {
    const cur = liveRef.current;
    if (!cur) return;
    const next = { ...cur, points: [...cur.points, { x, y }] };
    liveRef.current = next;
    setLive(next);
  }, []);

  const end = useCallback(() => {
    const cur = liveRef.current;
    liveRef.current = null;
    setLive(null);
    if (cur && cur.points.length >= 2) onStrokeEnd(cur);
  }, [onStrokeEnd]);

  const pan = Gesture.Pan()
    .enabled(enabled)
    .minDistance(0)
    .onBegin((e) => {
      runOnJS(begin)(e.x, e.y);
    })
    .onChange((e) => {
      runOnJS(move)(e.x, e.y);
    })
    .onFinalize(() => {
      runOnJS(end)();
    });

  const all = live ? [...strokes, live] : strokes;

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <GestureDetector gesture={pan}>
        <View style={styles.canvas} collapsable={false}>
          <Svg width={sizeBox.width} height={sizeBox.height}>
            {all.map((s) => (
              <Path
                key={s.id}
                d={strokesToSvgPath(s.points)}
                stroke={s.color}
                strokeWidth={s.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={s.tool === 'eraser' ? 1 : 1}
              />
            ))}
          </Svg>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.canvas,
    borderRadius: 0,
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
  },
});
