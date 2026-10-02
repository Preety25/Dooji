/**
 * Library — creation-first overview + open Creation detail.
 */
import { useRouter } from 'expo-router';
import React, { useState, type ReactNode } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { DoojiHeader } from '../components/DoojiHeader';
import { SoftButton } from '../components/SoftButton';
import { DoodlePreview } from '../components/sticker/DoodlePreview';
import { useTheme } from '../design/theme';
import { radius, spacing, type } from '../design/tokens';
import { STYLES, type Creation } from '../models/types';
import { LIBRARY_DELETE_COLOR, assetsForCurrentSource } from '../product';
import { useApp } from '../state/AppContext';

export default function LibraryScreen() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [detail, setDetail] = useState<Creation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openOverview = (c: Creation) => {
    setDetail(c);
  };

  /** Your doodle → Canvas (no dirty draft until strokes change). */
  const openDoodle = (c: Creation) => {
    app.openCreation(c.id, { destination: 'canvas' });
    router.replace('/');
    setDetail(null);
  };

  /** Generated style variant → Result for that asset. */
  const openGeneration = (c: Creation, assetId: string) => {
    app.openCreation(c.id, { destination: 'result', assetId });
    router.replace('/result');
    setDetail(null);
  };

  const sorted = [...app.library].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  if (detail) {
    return (
      <CreationDetail
        creation={detail}
        colors={colors}
        insets={insets}
        onBack={() => {
          setConfirmDelete(false);
          setDetail(null);
        }}
        onOpenDoodle={() => openDoodle(detail)}
        onOpenGeneration={(id) => openGeneration(detail, id)}
        onRequestDelete={() => setConfirmDelete(true)}
        confirmDelete={confirmDelete}
        onCancelDelete={() => setConfirmDelete(false)}
        onConfirmDelete={() => {
          void app.deleteCreation(detail.id);
          setConfirmDelete(false);
          setDetail(null);
        }}
      />
    );
  }

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
        title="Library"
        onBack={() => router.back()}
        showLibrary={false}
        showThemeToggle={false}
      />

      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>
            Nothing here yet
          </Text>
          <Text style={[styles.emptyBody, { color: colors.muted }]}>
            Save a Dooji and it'll live here.
          </Text>
          <SoftButton label="Start drawing" onPress={() => router.replace('/')} />
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{
            padding: spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            gap: spacing.md,
          }}
          columnWrapperStyle={{ gap: spacing.md }}
          renderItem={({ item }) => {
            const currentAssets = assetsForCurrentSource(item);
            const asset = currentAssets[0];
            const title = creationTitle(item);
            return (
              <Pressable
                style={[styles.card, { backgroundColor: 'transparent' }]}
                onPress={() => openOverview(item)}
                accessibilityLabel={`${title}, ${currentAssets.length} styles`}
              >
                <View
                  style={[
                    styles.thumbWrap,
                    { backgroundColor: colors.styleTile },
                  ]}
                >
                  {asset ? (
                    <Image
                      source={{ uri: asset.imageUri }}
                      style={styles.thumb}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.thumb}>
                      <DoodlePreview strokes={item.strokes} />
                    </View>
                  )}
                </View>
                <Text
                  style={[styles.metaTitle, { color: colors.ink }]}
                  numberOfLines={1}
                >
                  {title} ({currentAssets.length})
                </Text>
                <Text style={[styles.metaDate, { color: colors.muted }]}>
                  {new Date(item.updatedAt).toLocaleDateString()}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function CreationDetail({
  creation,
  colors,
  insets,
  onBack,
  onOpenDoodle,
  onOpenGeneration,
  onRequestDelete,
  confirmDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  creation: Creation;
  colors: ReturnType<typeof useTheme>['colors'];
  insets: { bottom: number };
  onBack: () => void;
  onOpenDoodle: () => void;
  onOpenGeneration: (id: string) => void;
  onRequestDelete: () => void;
  confirmDelete: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const title = creationTitle(creation);
  const gens = assetsForCurrentSource(creation);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: 0, backgroundColor: colors.surface, flex: 1 },
      ]}
    >
      <View style={{ paddingTop: 48 }}>
        <DoojiHeader
          showWordmark={false}
          showBack
          title="Library"
          onBack={onBack}
          showLibrary={false}
          showThemeToggle={false}
        />
      </View>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: Math.max(insets.bottom, 24),
        }}
      >
        <Text style={[styles.detailTitle, { color: colors.ink }]}>{title}</Text>
        <View style={styles.detailGrid}>
          <DetailCard
            title="Your doodle"
            colors={colors}
            onPress={onOpenDoodle}
          >
            <DoodlePreview strokes={creation.strokes} />
          </DetailCard>
          {gens.map((g) => (
            <DetailCard
              key={g.id}
              title={STYLES.find((s) => s.id === g.style)?.label ?? g.style}
              colors={colors}
              onPress={() => onOpenGeneration(g.id)}
            >
              <Image
                source={{ uri: g.imageUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
              />
            </DetailCard>
          ))}
        </View>
        <Pressable
          onPress={onRequestDelete}
          style={styles.deleteBtn}
          accessibilityRole="button"
          accessibilityLabel="Delete creation"
        >
          <MaterialIcons name="delete-outline" size={18} color={LIBRARY_DELETE_COLOR} />
          <Text style={[styles.deleteLabel, { color: LIBRARY_DELETE_COLOR }]}>
            Delete creation
          </Text>
        </Pressable>
      </ScrollView>

      <Modal transparent visible={confirmDelete} animationType="fade">
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.surfaceElevated },
            ]}
          >
            <Text style={[styles.detailTitle, { color: colors.ink }]}>
              Delete this creation?
            </Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>
              Its doodle and every style will be removed from your Library.
            </Text>
            <SoftButton
              label="Delete"
              variant="danger"
              labelColor={LIBRARY_DELETE_COLOR}
              onPress={onConfirmDelete}
              accessibilityLabel="Delete creation"
            />
            <SoftButton label="Cancel" variant="ghost" onPress={onCancelDelete} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailCard({
  title,
  colors,
  onPress,
  children,
}: {
  title: string;
  colors: ReturnType<typeof useTheme>['colors'];
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={styles.detailCard}>
      <View
        style={[styles.detailThumb, { backgroundColor: colors.styleTile }]}
      >
        {children}
      </View>
      <Text style={[styles.metaTitle, { color: colors.ink }]}>{title}</Text>
    </Pressable>
  );
}

function creationTitle(c: Creation): string {
  const meta = c.metadata || {};
  if (typeof meta.title === 'string' && meta.title) return meta.title;
  return `Doodle · ${new Date(c.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyTitle: { ...type.editorial, fontSize: 28, textAlign: 'center' },
  emptyBody: { ...type.body, textAlign: 'center', fontSize: 15 },
  card: { flex: 1, maxWidth: '48%' },
  thumbWrap: {
    aspectRatio: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  thumb: { flex: 1, width: '100%', height: '100%' },
  metaTitle: {
    ...type.button,
    fontSize: 15,
    marginTop: spacing.sm,
    paddingHorizontal: 2,
  },
  metaDate: { ...type.caption, paddingHorizontal: 2 },
  detailTitle: {
    ...type.editorial,
    fontSize: 22,
    fontFamily: 'Figtree_700Bold',
    marginBottom: spacing.md,
    paddingHorizontal: 2,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  detailCard: { width: '47%' },
  detailThumb: {
    aspectRatio: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  deleteBtn: {
    marginTop: spacing.xxl,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  deleteLabel: { ...type.caption, fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  modalCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
});
