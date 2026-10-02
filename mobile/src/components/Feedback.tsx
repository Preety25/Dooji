import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '../design/theme';
import { motion, radius, spacing, type } from '../design/tokens';
import { SoftButton } from './SoftButton';

interface Props {
  visible: boolean;
  title?: string;
  body?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  cancelLabel?: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

/** Bottom sheet navigation guard — Stay only cancels this leave attempt. */
export function UnsavedDialog({
  visible,
  title,
  body,
  primaryLabel = 'Save and leave',
  secondaryLabel = 'Discard and leave',
  cancelLabel = 'Stay',
  onSave,
  onDiscard,
  onCancel,
}: Props) {
  const { colors } = useTheme();
  if (!visible) return null;
  const resolvedTitle = title || 'Keep this doodle?';
  const resolvedBody =
    body || "It isn't saved yet. Starting something new will clear it.";
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.title, { color: colors.ink }]}>{resolvedTitle}</Text>
          <Text style={[styles.body, { color: colors.muted }]}>{resolvedBody}</Text>
          <View style={styles.actions}>
            <SoftButton label={primaryLabel} variant="ink" onPress={onSave} />
            <SoftButton
              label={secondaryLabel}
              variant="sheetSecondary"
              onPress={onDiscard}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              onPress={onCancel}
              style={styles.stayHit}
            >
              <Text style={[styles.stay, { color: colors.ink }]}>{cancelLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface ConfirmProps {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Destructive-but-local confirmation (e.g. Discard changes). */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel = 'Discard changes',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmProps) {
  const { colors } = useTheme();
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
          <Text style={[styles.body, { color: colors.muted }]}>{body}</Text>
          <View style={styles.actions}>
            <SoftButton label={confirmLabel} variant="danger" onPress={onConfirm} />
            <SoftButton label={cancelLabel} variant="ghost" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface ToastProps {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

/** Lightweight canvas toast — "Canvas cleared. Undo" */
export function CanvasToast({
  visible,
  message,
  actionLabel,
  onAction,
}: ToastProps) {
  const { colors } = useTheme();
  if (!visible) return null;
  return (
    <View
      pointerEvents="box-none"
      style={styles.toastWrap}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.toast, { backgroundColor: colors.toastBg }]}>
        <Text style={[styles.toastText, { color: colors.toastText }]}>{message}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="button">
            <Text style={[styles.toastAction, { color: colors.toastText }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

interface GenProps {
  copy: string;
}

export function GeneratingView({ copy }: GenProps) {
  const pulse = useSharedValue(0.92);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withSpring(1, motion.soft), withSpring(0.92, motion.soft)),
      -1,
      false,
    );
  }, [pulse]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={styles.genWrap}>
      <Animated.View style={[styles.orb, anim]} />
      <Text style={styles.genCopy}>{copy}</Text>
    </View>
  );
}

interface ErrProps {
  message: string;
  onRetry: () => void;
  onEdit: () => void;
}

export function ErrorBanner({ message, onRetry, onEdit }: ErrProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.err, { backgroundColor: colors.dangerSoft }]}>
      <Text style={[styles.errText, { color: colors.ink }]}>{message}</Text>
      <View style={styles.errActions}>
        <SoftButton label="Retry" onPress={onRetry} style={{ flex: 1 }} />
        <SoftButton label="Edit" variant="secondary" onPress={onEdit} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

interface SemanticProps {
  onEdit: () => void;
  onKeep: () => void;
}

/** Only mount when server explicitly signals semantic uncertainty. */
export function SemanticWarningBanner({ onEdit, onKeep }: SemanticProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.semantic, { backgroundColor: colors.accentSoft }]}>
      <Text style={[styles.errText, { color: colors.ink }]}>
        We weren't totally sure what this was...
      </Text>
      <View style={styles.errActions}>
        <SoftButton label="Edit doodle" variant="secondary" onPress={onEdit} style={{ flex: 1 }} />
        <SoftButton label="Keep it weird" onPress={onKeep} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  sheet: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    ...type.title,
    fontSize: 20,
  },
  body: {
    ...type.body,
    fontSize: 15,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  stayHit: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stay: {
    ...type.button,
    fontSize: 15,
  },
  toastWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 12,
    alignItems: 'center',
    zIndex: 20,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  toastText: {
    ...type.body,
    fontSize: 14,
    fontFamily: 'Figtree_500Medium',
  },
  toastAction: {
    ...type.button,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  genWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  orb: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  genCopy: {
    ...type.title,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  err: {
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  semantic: {
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  errText: {
    ...type.body,
    textAlign: 'center',
  },
  errActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
