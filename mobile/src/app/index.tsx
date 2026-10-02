/**
 * Canvas — draw doodle, then Make it ✨ → Preview (first gen) or regenerate (edit).
 */
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CanvasToolbar } from '../components/CanvasToolbar';
import { SketchbookLoop } from '../components/canvas/SketchbookLoop';
import { DoodleCanvas } from '../components/DoodleCanvas';
import { DoojiHeader } from '../components/DoojiHeader';
import { CanvasToast, UnsavedDialog } from '../components/Feedback';
import { useTheme } from '../design/theme';
import { radius, spacing, type } from '../design/tokens';
import {
  SKETCH_ACCENT,
  SKETCH_INK,
  SKETCH_SUNNY,
} from '../data/sketchbookDoodles';
import { CANVAS_CLEARED_TOAST, hasEstablishedStyle } from '../product';
import { useApp } from '../state/AppContext';

export default function CanvasScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const app = useApp();
  const { colors, isDark } = useTheme();
  const prompt = app.leavePrompt;
  const [drawing, setDrawing] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  /**
   * Empty-state sketch session flag (Canvas-local, not product state).
   * true  → first empty entry of this Canvas session → may show sketch loop
   * false → user has interacted (or loaded strokes / cleared) → never restart until a new empty session
   */
  const [sketchSessionActive, setSketchSessionActive] = useState(
    () => app.creation.strokes.length === 0,
  );
  const creationIdRef = useRef(app.creation.id);
  const hintOpacity = useSharedValue(1);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  // Session lifecycle: distinguish new empty Canvas from Clear / interacted empty.
  useEffect(() => {
    const idChanged = creationIdRef.current !== app.creation.id;
    creationIdRef.current = app.creation.id;

    if (app.hasStrokes) {
      setSketchSessionActive(false);
      return;
    }
    // Clear (new or saved) always sets the toast — keep sketch dismissed.
    if (app.canvasClearedToast) {
      setSketchSessionActive(false);
      return;
    }
    // Genuine new empty Creation (New Doodle / fresh open) — restart sketch session.
    if (idChanged) {
      setSketchSessionActive(true);
    }
  }, [app.creation.id, app.hasStrokes, app.canvasClearedToast]);

  const showEmptyHint = !app.hasStrokes && !drawing;
  const showSketchLoop = showEmptyHint && sketchSessionActive;

  useEffect(() => {
    if (!showEmptyHint) {
      hintOpacity.value = 0;
    } else {
      hintOpacity.value = withTiming(1, { duration: reduceMotion ? 0 : 220 });
    }
  }, [showEmptyHint, hintOpacity, reduceMotion]);

  useEffect(() => {
    if (app.phase === 'preview') router.push('/preview');
    if (app.phase === 'generating') router.push('/generating');
    if (app.phase === 'result') router.replace('/result');
  }, [app.phase, router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (app.isEditDraft || (!app.creation.saved && app.hasStrokes)) {
        app.requestNewDoodle();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [app]);

  const hintAnim = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
  }));

  const showEditingBadge =
    (app.isEditDraft || hasEstablishedStyle(app.creation)) &&
    app.hasStrokes &&
    Boolean(app.creation.saved || app.isEditDraft);

  const sketchInk = isDark ? SKETCH_INK.dark : SKETCH_INK.light;
  const sketchAccent = isDark ? SKETCH_ACCENT.dark : SKETCH_ACCENT.light;
  const sketchSunny = isDark ? SKETCH_SUNNY.dark : SKETCH_SUNNY.light;

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <DoojiHeader showWordmark showLibrary showThemeToggle />

      <View
        style={[
          styles.canvasHost,
          {
            backgroundColor: colors.canvas,
            borderColor: isDark ? colors.border : 'transparent',
          },
        ]}
      >
        <DoodleCanvas
          strokes={app.creation.strokes}
          color={app.brushColor}
          size={app.brushSize}
          tool={app.tool}
          surfaceColor={colors.canvas}
          onStrokeStart={() => {
            setDrawing(true);
            setSketchSessionActive(false);
            hintOpacity.value = withTiming(0, {
              duration: reduceMotion ? 0 : 180,
            });
          }}
          onStrokeEnd={(stroke) => {
            setDrawing(false);
            app.addStroke(stroke);
          }}
          onLayoutSize={app.setCanvasLayout}
        />
        {showEmptyHint ? (
          <Animated.View pointerEvents="none" style={[styles.hint, hintAnim]}>
            <View style={styles.hintGroup}>
              {showSketchLoop ? (
                <SketchbookLoop
                  ink={sketchInk}
                  accent={sketchAccent}
                  sunny={sketchSunny}
                  reduceMotion={reduceMotion}
                />
              ) : null}
              <Text style={[styles.hintTitle, { color: colors.hint }]}>
                Start{' '}
                <Text style={[styles.hintEm, { color: colors.accent }]}>
                  drawing
                </Text>
                <Text style={{ color: colors.hint }}>...</Text>
              </Text>
              <Text style={[styles.hintSub, { color: colors.muted }]}>
                We'll use our magic
              </Text>
            </View>
          </Animated.View>
        ) : null}
        {showEditingBadge ? (
          <View pointerEvents="none" style={styles.editingBadgeWrap}>
            <View
              style={[
                styles.editingBadge,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.editingText, { color: colors.muted }]}>
                Editing your doodle
              </Text>
            </View>
          </View>
        ) : null}
        <CanvasToast
          visible={app.canvasClearedToast}
          message={CANVAS_CLEARED_TOAST}
          actionLabel="Undo"
          onAction={() => {
            app.undo();
            app.dismissClearedToast();
          }}
        />
      </View>

      <View style={{ paddingBottom: Math.max(insets.bottom, spacing.sm) }}>
        <CanvasToolbar
          tool={app.tool}
          color={app.brushColor}
          size={app.brushSize}
          colors={app.brushColors}
          canUndo={app.canUndo}
          canRedo={app.canRedo}
          hasStrokes={app.hasStrokes}
          onUndo={app.undo}
          onRedo={app.redo}
          onTool={app.setTool}
          onColor={app.setColor}
          onSize={app.setSize}
          onClear={app.clearCanvas}
          onMakeIt={() => app.makeIt()}
        />
      </View>

      <UnsavedDialog
        visible={Boolean(prompt)}
        title={prompt?.title}
        body={prompt?.body}
        primaryLabel={prompt?.primaryLabel}
        secondaryLabel={prompt?.secondaryLabel}
        cancelLabel={prompt?.cancelLabel}
        onSave={() => void app.confirmLeave('save')}
        onDiscard={() => void app.confirmLeave('discard')}
        onCancel={() => void app.confirmLeave('stay')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  canvasHost: {
    flex: 1,
    marginHorizontal: spacing.lg,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
  },
  hint: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  /** One centered composition inside the canvas content area only. */
  hintGroup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintTitle: {
    ...type.editorial,
    fontSize: 40,
    lineHeight: 44,
    textAlign: 'center',
  },
  hintEm: {
    ...type.editorialEm,
    fontSize: 40,
    lineHeight: 44,
  },
  hintSub: {
    ...type.body,
    fontSize: 14,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  editingBadgeWrap: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
  },
  editingBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  editingText: {
    ...type.caption,
    fontSize: 13,
    fontFamily: 'Figtree_500Medium',
  },
});
