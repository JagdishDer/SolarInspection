import React, { useEffect } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { useAnimatedValue } from "@/utils/useAnimatedValue";

import { colors } from "@/constants/theme";

interface SolarBackdropProps {
  /** 'hero' renders the full scene (sun + rays + hills + panels); 'calm' is subtler. */
  variant?: "hero" | "calm";
}

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const PANEL_ANGLES = [-16, -14, -17, -15, -16, -14, -18, -15];

/**
 * Decorative solar-farm backdrop art, rendered behind screen content.
 * Pure React Native (no native modules): a glowing sun with a slowly
 * rotating ray ring, rolling hills and tilted panel silhouettes — all
 * low-opacity so cards and text stay readable. Native-driver animations.
 */
export function SolarBackdrop({ variant = "calm" }: SolarBackdropProps) {
  const spin = useAnimatedValue(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 120_000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const hero = variant === "hero";

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Sun glow + core */}
      <View style={[styles.glowOuter, { opacity: hero ? 0.5 : 0.32 }]} />
      <View style={[styles.glowInner, { opacity: hero ? 0.55 : 0.36 }]} />
      <View style={styles.sunCore} />

      {/* Rotating ray dots */}
      <Animated.View style={[styles.rayRing, { transform: [{ rotate }] }]}>
        {RAY_ANGLES.map((angle) => (
          <View key={angle} style={styles.rayAnchor}>
            <View
              style={[
                styles.rayDot,
                { transform: [{ rotate: `${angle}deg` }, { translateX: 86 }] },
              ]}
            />
          </View>
        ))}
      </Animated.View>

      {/* Hills */}
      <View style={[styles.hillFar, { opacity: hero ? 0.9 : 0.6 }]} />
      <View style={[styles.hillNear, { opacity: hero ? 0.9 : 0.55 }]} />

      {/* Panel row silhouettes */}
      {hero && (
        <View style={styles.panelRow}>
          {PANEL_ANGLES.map((angle, i) => (
            <View
              key={i}
              style={[
                styles.panelLeg,
                { transform: [{ rotate: `${angle}deg` }] },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const SUN_SIZE = 132;

const styles = StyleSheet.create({
  glowOuter: {
    position: "absolute",
    top: -96,
    right: -72,
    width: SUN_SIZE + 208,
    height: SUN_SIZE + 208,
    borderRadius: (SUN_SIZE + 208) / 2,
    backgroundColor: colors.sunSoft,
  },
  glowInner: {
    position: "absolute",
    top: -48,
    right: -24,
    width: SUN_SIZE + 96,
    height: SUN_SIZE + 96,
    borderRadius: (SUN_SIZE + 96) / 2,
    backgroundColor: colors.sunSoft,
  },
  sunCore: {
    position: "absolute",
    top: -14,
    right: 18,
    width: SUN_SIZE,
    height: SUN_SIZE,
    borderRadius: SUN_SIZE / 2,
    backgroundColor: colors.sun,
    opacity: 0.5,
  },
  rayRing: {
    position: "absolute",
    top: 44,
    right: 46,
    width: 4,
    height: 4,
  },
  rayAnchor: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 4,
    height: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  rayDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.sun,
    opacity: 0.55,
  },
  hillFar: {
    position: "absolute",
    bottom: -170,
    left: -140,
    width: 620,
    height: 320,
    borderRadius: 320,
    backgroundColor: colors.hillDeep,
  },
  hillNear: {
    position: "absolute",
    bottom: -210,
    right: -160,
    width: 700,
    height: 340,
    borderRadius: 340,
    backgroundColor: colors.hill,
  },
  panelRow: {
    position: "absolute",
    bottom: 34,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    opacity: 0.5,
  },
  panelLeg: {
    width: 34,
    height: 22,
    borderRadius: 3,
    backgroundColor: colors.panelDark,
    borderTopWidth: 3,
    borderTopColor: "#5B6B85",
  },
});
