import React, { useCallback } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { uploadStatusLabel } from '@/constants/domain';
import { colors, radii, spacing } from '@/constants/theme';
import type { InspectionPhoto, UploadStatus } from '@/types';

interface PhotoGridProps {
  photos: InspectionPhoto[];
  onAddPhoto: () => void;
  onDeletePhoto: (photo: InspectionPhoto) => void;
  addDisabled?: boolean;
}

function uploadDotColor(status: UploadStatus): string {
  switch (status) {
    case 'uploaded':
      return colors.success;
    case 'failed':
      return colors.danger;
    default:
      return colors.warning;
  }
}

/**
 * Thumbnail grid of inspection photos with an add tile. Deleting prompts
 * for confirmation; upload status is shown as a colored dot + caption.
 */
export function PhotoGrid({ photos, onAddPhoto, onDeletePhoto, addDisabled = false }: PhotoGridProps) {
  const confirmDelete = useCallback(
    (photo: InspectionPhoto) => {
      Alert.alert('Delete photo', 'Remove this photo from the inspection?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDeletePhoto(photo) },
      ]);
    },
    [onDeletePhoto],
  );

  return (
    <View style={styles.grid}>
      <Pressable
        onPress={onAddPhoto}
        disabled={addDisabled}
        accessibilityRole="button"
        accessibilityLabel="Add photo"
        style={({ pressed }) => [styles.tile, styles.addTile, pressed && styles.pressed, addDisabled && styles.disabled]}
      >
        <Ionicons name="camera-outline" size={24} color={addDisabled ? colors.textTertiary : colors.primary} />
        <Text style={[styles.addText, addDisabled && styles.addTextDisabled]}>Add photo</Text>
      </Pressable>

      {photos.map((photo) => (
        <View key={photo.id} style={styles.tile}>
          <Image source={{ uri: photo.localUri }} style={styles.image} resizeMode="cover" />
          <Pressable
            onPress={() => confirmDelete(photo)}
            style={styles.deleteButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Delete photo"
          >
            <Ionicons name="close" size={14} color="#FFFFFF" />
          </Pressable>
          <View style={[styles.statusDot, { backgroundColor: uploadDotColor(photo.uploadStatus) }]}>
            <Ionicons
              name={photo.uploadStatus === 'uploaded' ? 'checkmark' : 'arrow-up'}
              size={10}
              color="#FFFFFF"
            />
          </View>
          {photo.uploadStatus !== 'uploaded' && (
            <Text style={styles.statusCaption} numberOfLines={1}>
              {uploadStatusLabel(photo.uploadStatus)}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const TILE_SIZE = 96;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  addTile: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
  addText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  addTextDisabled: {
    color: colors.textTertiary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCaption: {
    position: 'absolute',
    bottom: 4,
    left: 26,
    right: 4,
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 2,
  },
});
