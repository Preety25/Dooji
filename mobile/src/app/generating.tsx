/**
 * Generating — Trace→Morph→Inflate→Material + technical / rate-limit errors.
 * Rate-limited uses the same visual family as technical failure.
 */
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DoojiHeader } from '../components/DoojiHeader';
import { TransformMorph } from '../components/generating/TransformMorph';
import { SoftButton } from '../components/SoftButton';
import { DoodlePreview } from '../components/sticker/DoodlePreview';
import { useTheme } from '../design/theme';
import { spacing, type } from '../design/tokens';
import {
  GENERATING_SUB,
  GENERATING_TITLE,
  RATE_LIMITED_COPY,
  TECHNICAL_ERROR_BODY,
  TECHNICAL_ERROR_TITLE,
} from '../product';
import { useApp } from '../state/AppContext';
import { transformDebug } from '../lib/transformDebug';

export default function GeneratingScreen() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const failed = Boolean(app.lastError);
  const rateLimited = Boolean(
    app.lastError &&
      (app.lastError.includes('limit') ||
        app.lastError === RATE_LIMITED_COPY),
  );
  const styleId = app.selectedStyle || app.creation.style || 'gummy';
  // Only treat provider as ready once we've left Generating — avoids
  // restarting/accelerating morph off a stale activeAsset mid-flight.
  const providerReady = app.phase === 'result';
  const resultUri =
    app.phase === 'result' || !app.activeJob
      ? app.activeAsset?.imageUri
      : undefined;

  useEffect(() => {
    transformDebug('Generating-mounted', {
      phase: app.phase,
      styleId,
      activeJob: app.activeJob?.status,
      hasError: failed,
    });
    return () => {
      transformDebug('Generating-unmounted');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    transformDebug('Generating-state', {
      phase: app.phase,
      providerReady,
      resultUri: resultUri ? String(resultUri).slice(0, 60) : null,
      activeJob: app.activeJob?.status,
      activeAsset: app.activeAsset?.id,
      lastError: app.lastError,
    });
  }, [
    app.phase,
    providerReady,
    resultUri,
    app.activeJob?.status,
    app.activeAsset?.id,
    app.lastError,
  ]);

  useEffect(() => {
    if (app.phase === 'result') {
      transformDebug('navigate-result');
      router.replace('/result');
    }
    if (app.phase === 'preview') router.replace('/preview');
    if (app.phase === 'canvas' && !failed) router.replace('/');
  }, [app.phase, failed, router]);

  const goEdit = () => {
    app.dismissError();
    app.editDoodle();
    router.replace('/');
  };

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
      accessibilityLiveRegion="polite"
    >
      <DoojiHeader
        showWordmark={false}
        showBack
        onBack={goEdit}
        showLibrary={failed}
        showThemeToggle={failed}
      />

      <View style={styles.stage}>
        {failed ? (
          <View style={styles.failedArt}>
            <DoodlePreview
              strokes={app.creation.strokes}
              label="Your doodle, safe and unchanged"
            />
          </View>
        ) : (
          <TransformMorph
            strokes={app.creation.strokes}
            styleId={styleId}
            resultUri={resultUri}
            providerReady={providerReady}
          />
        )}
      </View>

      <View style={styles.footer}>
        {failed ? (
          <>
            <Text style={[styles.title, { color: colors.ink }]}>
              {rateLimited
                ? "You've reached your generation limit for now."
                : TECHNICAL_ERROR_TITLE}
            </Text>
            <Text style={[styles.sub, { color: colors.muted }]}>
              {rateLimited
                ? 'Try again later. Your doodle and Library are safe.'
                : TECHNICAL_ERROR_BODY}
            </Text>
            <View style={styles.row}>
              <SoftButton
                label="Edit doodle"
                variant="secondary"
                onPress={goEdit}
                style={{ flex: 1 }}
              />
              {rateLimited ? (
                <SoftButton
                  label="Back"
                  variant="ink"
                  onPress={goEdit}
                  style={{ flex: 1 }}
                />
              ) : (
                <SoftButton
                  label="Try again"
                  variant="ink"
                  onPress={() => void app.retryTransform()}
                  style={{ flex: 1 }}
                />
              )}
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.titleDisplay, { color: colors.ink }]}>
              {GENERATING_TITLE}
            </Text>
            <Text style={[styles.sub, { color: colors.muted }]}>
              {GENERATING_SUB}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  failedArt: {
    width: 260,
    height: 260,
    opacity: 0.5,
  },
  footer: {
    minHeight: 168,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    ...type.title,
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: -0.4,
  },
  titleDisplay: {
    ...type.editorial,
    textAlign: 'center',
    fontSize: 22,
    fontFamily: 'Newsreader_600SemiBold',
  },
  sub: {
    ...type.body,
    textAlign: 'center',
    fontSize: 15,
  },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
});
