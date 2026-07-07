import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../../theme';
import PremiumCard from './PremiumCard';

function clampProgress(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export default function CellaringProgressCard({
  name,
  brand,
  currentMonths,
  targetMonths,
  readyLabel,
  progress,
  onPress,
  style,
}) {
  const computedProgress =
    typeof progress === 'number'
      ? progress
      : targetMonths > 0
        ? currentMonths / targetMonths
        : 0;
  const targetProgress = clampProgress(computedProgress);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const isReady = targetProgress >= 1;

  useEffect(() => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: targetProgress,
      duration: 650,
      useNativeDriver: false,
    }).start();
  }, [progressAnim, targetProgress, currentMonths, targetMonths]);

  const fillWidth =
    trackWidth > 0
      ? progressAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, trackWidth],
        })
      : 0;

  const meta = [brand].filter(Boolean).join(' · ');
  const monthLabel =
    typeof currentMonths === 'number' && typeof targetMonths === 'number'
      ? `${currentMonths} / ${targetMonths} Months`
      : null;

  return (
    <PremiumCard onPress={onPress} style={style} contentStyle={styles.content}>
      <Text style={styles.name} numberOfLines={1}>
        {name || 'Unknown'}
      </Text>
      {meta ? (
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
      {monthLabel ? (
        <Text style={[styles.months, isReady && styles.monthsReady]}>{monthLabel}</Text>
      ) : null}
      <View
        style={styles.track}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <Animated.View
          style={[
            styles.fill,
            isReady && styles.fillReady,
            trackWidth > 0 ? { width: fillWidth } : { width: 0 },
          ]}
        />
      </View>
      {readyLabel ? (
        <Text style={[styles.ready, isReady && styles.readyComplete]}>{readyLabel}</Text>
      ) : null}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
  name: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  months: {
    ...typography.body,
    color: colors.gold,
    marginTop: spacing.sm,
  },
  monthsReady: {
    color: colors.goldBright,
  },
  track: {
    height: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surfaceLight,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  fill: {
    height: '100%',
    borderRadius: borderRadius.pill,
    backgroundColor: colors.goldMuted,
  },
  fillReady: {
    backgroundColor: colors.gold,
  },
  ready: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  readyComplete: {
    color: colors.goldBright,
    fontWeight: '600',
  },
});
