import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { enableFreeze } from "react-native-screens";

import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { colors } from "@/constants/theme";
import { bootstrapApp } from "@/services/bootstrap";

// Freeze off-screen navigators so hidden screens never re-render
// (must run before any navigator mounts).
enableFreeze(true);

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    bootstrapApp()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setBootError(
            error instanceof Error ? error.message : "Unknown startup error"
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (bootError !== null) {
    return (
      <View style={styles.center}>
        <ErrorState
          title="Could not start app"
          message={`The local database failed to initialize: ${bootError}`}
          onRetry={() => {
            setBootError(null);
            bootstrapApp()
              .then(() => setReady(true))
              .catch((error: unknown) =>
                setBootError(
                  error instanceof Error
                    ? error.message
                    : "Unknown startup error"
                )
              );
          }}
        />
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <LoadingState label="Preparing local database…" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          freezeOnBlur: true,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sites/[siteId]" />
        <Stack.Screen name="inspections/create" />
        <Stack.Screen name="inspections/[inspectionId]" />
        <Stack.Screen name="equipment/[equipmentId]" />
        <Stack.Screen
          name="camera"
          options={{ presentation: "fullScreenModal" }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
  },
});
