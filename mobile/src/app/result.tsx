/**
 * Result — hero Dooji, style tiles, Save/Share, Edit/New.
 * Edit-draft of a saved Creation uses Save changes / Discard changes.
 */
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { DoojiHeader } from '../components/DoojiHeader';
import { SoftButton } from '../components/SoftButton';
import { StyleSelector } from '../components/StyleSelector';
import {
  ConfirmSheet,
  SemanticWarningBanner,
  UnsavedDialog,
} from '../components/Feedback';
import { useTheme } from '../design/theme';
import { radius, spacing, type } from '../design/tokens';
import {
  DISCARD_EDIT_BODY,
  DISCARD_EDIT_TITLE,
  REVEAL_CAPTION,
} from '../product';
import { useApp } from '../state/AppContext';

export default function ResultScreen() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const prompt = app.leavePrompt;
  const uri = app.activeAsset?.imageUri;
  const staged =
    app.selectedStyle && !app.selectedStyleIsGenerated
      ? app.selectedStyle
      : null;
  const editDraft = app.isEditDraft;

  useEffect(() => {
    if (app.phase === 'generating') router.replace('/generating');
    if (app.phase === 'preview') router.replace('/preview');
    if (app.phase === 'canvas' && !app.activeAsset) router.replace('/');
  }, [app.phase, app.activeAsset, router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      app.requestNewDoodle();
      return true;
    });
    return () => sub.remove();
  }, [app]);

  const goLibrary = () => {
    app.requestLeave({ type: 'library' }, () => router.push('/library'));
  };

  const onShare = async () => {
    const shareUri = (await app.shareCurrent()) || uri;
    if (!shareUri) return;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(shareUri);
    }
  };

  const primarySaveLabel = editDraft
    ? 'Save changes'
    : app.creation.saved
      ? 'Saved'
      : 'Save';

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, backgroundColor: colors.surface },
      ]}
    >
      <DoojiHeader
        showWordmark={false}
        showBack
        onBack={() => app.requestNewDoodle()}
        showLibrary
        onLibraryPress={goLibrary}
        showThemeToggle
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.caption, { color: colors.muted }]}>
          {REVEAL_CAPTION}
        </Text>

        <Animated.View
          entering={FadeIn.duration(380)}
          style={[styles.hero, { backgroundColor: 'transparent' }]}
        >
          {uri ? (
            <Image
              source={{ uri }}
              style={[styles.image, { backgroundColor: 'transparent' }]}
              resizeMode="contain"
            />
          ) : (
            <Text style={[styles.missing, { color: colors.muted }]}>
              No image yet
            </Text>
          )}
        </Animated.View>

        {app.semanticWarning && !app.lastError ? (
          <SemanticWarningBanner
            onEdit={() => {
              app.editDoodle();
              router.replace('/');
            }}
            onKeep={() => app.dismissSemanticWarning()}
          />
        ) : null}

        <Animated.View
          entering={FadeInDown.delay(60).springify()}
          style={styles.block}
        >
          <View style={styles.styleHeader}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>
              Change style
            </Text>
            {staged ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={app.createCtaLabel}
                onPress={() => void app.createSelectedStyle()}
                style={[styles.makeStyle, { backgroundColor: colors.limeCta }]}
              >
                <Text style={[styles.makeStyleText, { color: colors.limeCtaText }]}>
                  {app.createCtaLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <StyleSelector selected={app.selectedStyle} onSelect={app.selectStyle} />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(120).springify()}
          style={styles.actions}
        >
          <SoftButton
            label={primarySaveLabel}
            variant="secondary"
            onPress={() =>
              void (editDraft ? app.saveChanges() : app.saveCreation())
            }
            style={{ flex: 1 }}
            icon={
              !editDraft && app.creation.saved ? (
                <MaterialIcons
                  name="check"
                  size={18}
                  color={colors.checkmark}
                />
              ) : undefined
            }
          />
          <SoftButton
            label="Share"
            onPress={() => void onShare()}
            style={{ flex: 1 }}
            icon={
              <MaterialIcons name="share" size={18} color="#FFFFFF" />
            }
          />
        </Animated.View>

        {editDraft ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.footerScrollContent}
            style={styles.footerScroll}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Discard changes"
              onPress={() => app.requestDiscardChanges()}
              style={styles.textAction}
            >
              <MaterialIcons name="delete-outline" size={18} color={colors.ink} />
              <Text style={[styles.textActionLabel, { color: colors.ink }]}>
                Discard changes
              </Text>
            </Pressable>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit doodle"
              onPress={() => {
                app.editDoodle();
                router.replace('/');
              }}
              style={styles.textAction}
            >
              <MaterialIcons name="edit" size={18} color={colors.ink} />
              <Text style={[styles.textActionLabel, { color: colors.ink }]}>
                Edit doodle
              </Text>
            </Pressable>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New doodle"
              onPress={() => app.requestNewDoodle()}
              style={styles.textAction}
            >
              <MaterialIcons name="add" size={20} color={colors.ink} />
              <Text style={[styles.textActionLabel, { color: colors.ink }]}>
                New doodle
              </Text>
            </Pressable>
          </ScrollView>
        ) : (
          <View style={styles.footerCentered}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit doodle"
              onPress={() => {
                app.editDoodle();
                router.replace('/');
              }}
              style={styles.textAction}
            >
              <MaterialIcons name="edit" size={18} color={colors.ink} />
              <Text style={[styles.textActionLabel, { color: colors.ink }]}>
                Edit doodle
              </Text>
            </Pressable>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New doodle"
              onPress={() => app.requestNewDoodle()}
              style={styles.textAction}
            >
              <MaterialIcons name="add" size={20} color={colors.ink} />
              <Text style={[styles.textActionLabel, { color: colors.ink }]}>
                New doodle
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

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

      <ConfirmSheet
        visible={app.discardConfirmVisible}
        title={DISCARD_EDIT_TITLE}
        body={DISCARD_EDIT_BODY}
        confirmLabel="Discard changes"
        cancelLabel="Cancel"
        onConfirm={() => {
          app.confirmDiscardChanges();
          router.replace('/result');
        }}
        onCancel={() => app.cancelDiscardChanges()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  caption: {
    ...type.caption,
    textAlign: 'center',
    minHeight: 18,
  },
  hero: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 300,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  missing: { ...type.body },
  block: { gap: spacing.sm },
  styleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  sectionLabel: { ...type.caption, fontSize: 14 },
  makeStyle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  makeStyleText: {
    ...type.button,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  footerCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    minHeight: 44 + spacing.sm,
  },
  footerScroll: {
    marginHorizontal: -spacing.lg,
  },
  footerScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    minHeight: 44 + spacing.sm,
  },
  textAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    flexShrink: 0,
  },
  textActionLabel: {
    ...type.body,
    fontSize: 15,
    fontFamily: 'Figtree_500Medium',
  },
  divider: { width: 1, height: 20, flexShrink: 0 },
});
