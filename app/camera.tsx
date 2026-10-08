import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { colors, radii, spacing, touchTarget } from '@/constants/theme';
import { getCurrentCoordinates } from '@/services/location/locationService';
import { persistCapturedPhoto, PhotoStoreError } from '@/services/photo/photoService';
import { useSyncStore } from '@/stores/syncStore';
import { useUiStore } from '@/stores/uiStore';

/**
 * Full-screen camera for capturing inspection photo evidence.
 * Works offline: capture -> compress -> store locally -> queue upload.
 */
export default function CameraScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    inspectionId: string;
    inspectionItemId?: string;
  }>();
  const inspectionId = typeof params.inspectionId === 'string' ? params.inspectionId : '';
  const inspectionItemId =
    typeof params.inspectionItemId === 'string' ? params.inspectionItemId : null;

  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const cameraRef = useRef<CameraView>(null);

  const onCancel = useCallback(() => {
    if (!saving) router.back();
  }, [saving, router]);

  const onCapture = useCallback((): void => {
    if (capturing || saving || cameraRef.current === null) return;
    setCapturing(true);
    setError(null);

    cameraRef.current
      .takePictureAsync({ quality: 0.8, imageType: 'jpg' })
      .then((photo) => {
        if (photo?.uri === undefined) throw new PhotoStoreError('Camera returned no image');
        setCapturing(false);
        setSaving(true);
        // GPS is best-effort metadata for the photo.
        return getCurrentCoordinates().then((coordinates) =>
          persistCapturedPhoto({
            capturedUri: photo.uri,
            inspectionId,
            inspectionItemId,
            coordinates,
          }),
        );
      })
      .then(() => {
        useUiStore.getState().bumpPhotoCaptureCount();
        void useSyncStore.getState().refreshCounts();
        router.back();
      })
      .catch((err: unknown) => {
        setError(
          err instanceof PhotoStoreError
            ? err.message
            : 'Could not capture the photo. Try again.',
        );
      })
      .finally(() => {
        setCapturing(false);
        setSaving(false);
      });
  }, [capturing, saving, inspectionId, inspectionItemId, router]);

  // Permission states -------------------------------------------------------
  if (permission === null || permission.granted === false) {
    const undetermined = permission?.canAskAgain ?? true;
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={40} color={colors.textTertiary} />
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionMessage}>
          Photo evidence is stored on the device and uploaded when a connection is
          available. You can also complete inspections without photos.
        </Text>
        {undetermined ? (
          <AppButton label="Allow camera access" onPress={() => void requestPermission()} style={styles.permissionButton} />
        ) : (
          <Text style={styles.permissionDenied}>
            Camera permission was denied. Enable it in system settings to add photos.
          </Text>
        )}
        <AppButton label="Close" variant="secondary" onPress={onCancel} style={styles.permissionButton} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" mode="picture" />

      {error !== null && (
        <View style={[styles.errorBox, { top: insets.top + spacing.xxl * 2 }]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={[styles.controls, { bottom: spacing.xxl * 2 + insets.bottom }]}>
        <Pressable
          onPress={onCancel}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={26} color="#FFFFFF" />
        </Pressable>

        <Pressable
          onPress={onCapture}
          disabled={capturing || saving}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          style={({ pressed }) => [styles.shutter, pressed && styles.pressed]}
        >
          {capturing || saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </Pressable>

        <View style={styles.cancelButton} />
      </View>

      {saving && (
        <View style={[styles.savingBox, { bottom: spacing.xxl * 2 + 90 + insets.bottom }]}>
          <Text style={styles.savingText}>Saving photo offline…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  permissionTitle: {
    marginTop: spacing.md,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  permissionMessage: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  permissionButton: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
  permissionDenied: {
    marginTop: spacing.lg,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
    maxWidth: 320,
  },
  controls: {
    position: 'absolute',
    bottom: spacing.xxl * 2,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  cancelButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
  pressed: {
    opacity: 0.7,
  },
  errorBox: {
    position: 'absolute',
    top: spacing.xxl * 2,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: radii.md,
    padding: spacing.md,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
  },
  savingBox: {
    position: 'absolute',
    bottom: spacing.xxl * 2 + 90,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  savingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
