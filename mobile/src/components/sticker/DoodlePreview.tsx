/**
 * Raw doodle preview — authorship / error states.
 */
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { fitStrokesToBox, toSvgPath } from '../../lib/morph';
import type { DoodleStroke } from '../../models/types';

interface Props {
  strokes: DoodleStroke[];
  label?: string;
}

export function DoodlePreview({ strokes, label }: Props) {
  const fitted = useMemo(
    () =>
      fitStrokesToBox(
        strokes.map((s) => ({
          id: s.id,
          color: s.color,
          width: s.width,
          points: s.points,
          closed: Boolean(s.closed),
        })),
      ),
    [strokes],
  );

  return (
    <Svg
      viewBox="0 0 400 400"
      style={StyleSheet.absoluteFill}
      accessibilityLabel={label}
      accessible={Boolean(label)}
    >
      {fitted.map((s) => (
        <Path
          key={s.id}
          d={toSvgPath(s.points, false)}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
