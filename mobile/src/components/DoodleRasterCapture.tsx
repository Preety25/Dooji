/**
 * Off-screen square transparent surface for capturing the doodle as PNG.
 * Mounted invisibly; AppContext captures via ref before POST /v1/transform.
 */
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import { strokesToSvgPath } from '../lib/strokes';
import { RASTER_SIZE, mapStrokesToSquare, stripDataUriBase64 } from '../lib/rasterize';
import type { DoodleStroke } from '../models/types';

export interface DoodleRasterHandle {
  /** Returns raw base64 PNG (no data: prefix). Transparent bg, RASTER_SIZE². */
  capturePngBase64: () => Promise<string>;
}

interface Props {
  strokes: DoodleStroke[];
  canvasWidth: number;
  canvasHeight: number;
}

export const DoodleRasterCapture = forwardRef<DoodleRasterHandle, Props>(
  function DoodleRasterCapture({ strokes, canvasWidth, canvasHeight }, ref) {
    const viewRef = useRef<View>(null);

    useImperativeHandle(ref, () => ({
      capturePngBase64: async () => {
        if (!viewRef.current) {
          throw new Error('raster_surface_missing');
        }
        const raw = await captureRef(viewRef, {
          format: 'png',
          quality: 1,
          result: 'base64',
          width: RASTER_SIZE,
          height: RASTER_SIZE,
        });
        const b64 = stripDataUriBase64(String(raw));
        if (!b64 || b64.length < 32) {
          throw new Error('raster_capture_empty');
        }
        return b64;
      },
    }));

    const mapped = mapStrokesToSquare(
      strokes.filter((s) => s.tool === 'brush' && s.points.length >= 2),
      canvasWidth,
      canvasHeight,
      RASTER_SIZE,
    );

    return (
      <View
        pointerEvents="none"
        style={styles.host}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View
          ref={viewRef}
          collapsable={false}
          style={styles.surface}
        >
          <Svg width={RASTER_SIZE} height={RASTER_SIZE}>
            {mapped.map((s) => (
              <Path
                key={s.id}
                d={strokesToSvgPath(s.points)}
                stroke={s.color}
                strokeWidth={s.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
          </Svg>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: -RASTER_SIZE * 2,
    top: 0,
    width: RASTER_SIZE,
    height: RASTER_SIZE,
    opacity: 0,
  },
  surface: {
    width: RASTER_SIZE,
    height: RASTER_SIZE,
    backgroundColor: 'transparent',
  },
});
