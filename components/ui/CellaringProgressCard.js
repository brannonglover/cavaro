import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
    <PremiumCard
      onPress={onPress}
      variant={isReady ? 'warm' : 'elevated'}
      padding={0}
      style={[styles.card, style]}
    >
      <View style={styles.inner}>
        <View style={styles.watermark} pointerEvents="none">
          <MaterialCommunityIcons
            name="barrel-outline"
            size={52}
            color={isReady ? 'rgba(200, 164, 93, 0.12)' : 'rgba(143, 116, 64, 0.1)'}
          />
        </View>
        <View style={styles.header}>
          <View style={[styles.iconWrap, isReady && styles.iconWrapReady]}>
            <MaterialCommunityIcons
              name={isReady ? 'check-circle-outline' : 'timer-sand'}
              size={18}
              color={isReady ? colors.goldBright : colors.goldMuted}
            />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>
              {name || 'Unknown'}
            </Text>
            {meta ? (
              <Text style={styles.meta} numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
          </View>
        </View>
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
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  inner: {
    padding: spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    right: -4,
    top: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(143, 116, 64, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrapReady: {
    backgroundColor: 'rgba(200, 164, 93, 0.18)',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.sectionTitle,
    fontSize: 16,
    lineHeight: 20,
    color: colors.text,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  months: {
    ...typography.body,
    fontSize: 14,
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
