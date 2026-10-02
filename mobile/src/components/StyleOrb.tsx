/**
 * Static material reference orbs — bundled final design assets.
 */
import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import type { StyleId } from '../models/types';

const ORBS: Record<StyleId, ImageSourcePropType> = {
  gummy: require('../../assets/styles/orb-gummy.png'),
  clay: require('../../assets/styles/orb-clay.png'),
  plush: require('../../assets/styles/orb-plush.png'),
  glossy: require('../../assets/styles/orb-glossy.png'),
};

interface Props {
  styleId: StyleId;
  size?: number;
}

export function StyleOrb({ styleId, size = 96 }: Props) {
  return (
    <View style={[styles.host, { width: size, height: size }]}>
      <Image
        source={ORBS[styleId]}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
