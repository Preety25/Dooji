/**
 * Preview — final layout: heading + X, centered tiles+Surprise composition.
 */
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { DoojiHeader } from '../components/DoojiHeader';
import { SoftButton } from '../components/SoftButton';
import { StyleMaterialGrid } from '../components/StyleMaterialGrid';
import { useTheme } from '../design/theme';
import { spacing, type } from '../design/tokens';
import { useApp } from '../state/AppContext';

export default function PreviewScreen() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  useEffect(() => {
    if (app.phase === 'generating') router.replace('/generating');
    if (app.phase === 'result') router.replace('/result');
    if (app.phase === 'canvas') router.replace('/');
  }, [app.phase, router]);

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, spacing.lg),
          backgroundColor: colors.surface,
        },
      ]}
    >
      <DoojiHeader showWordmark showLibrary showThemeToggle />

      <View style={styles.titleRow}>
        <Text style={[styles.heading, { color: colors.muted }]}>
          Pick a style for your{'\n'}
          <Text style={{ color: colors.ink }}>Dooji</Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close and keep drawing"
          onPress={() => {
            app.closePreview();
            router.replace('/');
          }}
          hitSlop={12}
          style={styles.close}
        >
          <MaterialIcons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      {/* Single centered composition: tiles + Surprise me */}
      <View style={styles.composition}>
        <StyleMaterialGrid onSelect={app.selectStyle} />
        <SoftButton
          label="Surprise me"
          variant="secondary"
          onPress={app.surpriseMe}
          icon={
            <MaterialIcons name="auto-awesome" size={18} color={colors.makeItActiveIcon} />
          }
          style={{
            marginTop: spacing.xl,
            maxWidth: 316,
            alignSelf: 'center',
            width: '100%',
            borderColor: colors.surpriseBorder,
            borderWidth: 1.5,
            backgroundColor: 'transparent',
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  titleRow: {
    position: 'relative',
    paddingHorizontal: spacing.xl + 12,
    paddingTop: spacing.md,
    marginBottom: spacing.sm,
  },
  heading: {
    ...type.editorial,
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
    letterSpacing: -0.24,
  },
  close: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composition: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
