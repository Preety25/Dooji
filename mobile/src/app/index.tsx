import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CanvasToolbar } from '../components/CanvasToolbar';
import { DoodleCanvas } from '../components/DoodleCanvas';
import { ErrorBanner, UnsavedDialog } from '../components/Feedback';
import { colors, spacing, type } from '../design/tokens';
import { useApp } from '../state/AppContext';

export default function CanvasScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const app = useApp();
  const [confirmNew, setConfirmNew] = useState(false);

  useEffect(() => {
    if (app.phase === 'generating') router.push('/generating');
    if (app.phase === 'result') router.replace('/result');
  }, [app.phase, router]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#FFE8EF', '#FFF8F4', '#F3F0FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <Text style={styles.brand}>Dooji</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setConfirmNew(true)}
            hitSlop={8}
            style={styles.headerBtn}
          >
            <Text style={styles.headerBtnText}>New</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/library')}
            hitSlop={8}
            style={styles.headerBtn}
          >
            <Text style={styles.headerBtnText}>Library</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.canvasHost}>
        <DoodleCanvas
          strokes={app.creation.strokes}
          color={app.brushColor}
          size={app.brushSize}
          tool={app.tool}
          onStrokeEnd={app.addStroke}
          onLayoutSize={app.setCanvasLayout}
        />
        {!app.hasStrokes && (
          <View pointerEvents="none" style={styles.hint}>
            <Text style={styles.hintTitle}>Draw anything.</Text>
            <Text style={styles.hintSub}>Messy is good.</Text>
          </View>
        )}
      </View>

      {app.lastError ? (
        <ErrorBanner
          message={app.lastError}
          onRetry={() => void app.retryTransform()}
          onEdit={() => app.editDoodle()}
        />
      ) : null}

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
          onMakeIt={() => void app.makeIt()}
        />
      </View>

      <UnsavedDialog
        visible={confirmNew}
        dirty={app.dirty || (!app.creation.saved && app.hasStrokes)}
        onSave={async () => {
          await app.saveCreation();
          setConfirmNew(false);
          app.newDoodle();
        }}
        onDiscard={() => {
          setConfirmNew(false);
          app.newDoodle();
        }}
        onCancel={() => setConfirmNew(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    ...type.brand,
    color: colors.brand,
  },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  headerBtn: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
  },
  headerBtnText: {
    ...type.caption,
    color: colors.ink,
    fontFamily: 'Fredoka_500Medium',
  },
  canvasHost: {
    flex: 1,
    marginHorizontal: spacing.md,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintTitle: {
    ...type.title,
    color: colors.hint,
  },
  hintSub: {
    ...type.body,
    color: colors.hint,
    marginTop: 4,
  },
});
