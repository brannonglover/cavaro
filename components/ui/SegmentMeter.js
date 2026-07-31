import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';

const SEGMENT_COUNT = 5;

/**
 * 5-segment gold meter for pairing scores (1–5).
 */
export default function SegmentMeter({ value = 0, max = SEGMENT_COUNT, style }) {
  const filled = Math.min(max, Math.max(0, Math.round(Number(value) || 0)));

  return (
    <View style={[styles.row, style]}>
      {Array.from({ length: max }, (_, index) => (
        <View
          key={index}
          style={[
            styles.segment,
            index < filled ? styles.segmentFilled : styles.segmentEmpty,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  segment: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
  },
  segmentFilled: {
    backgroundColor: colors.gold,
  },
  segmentEmpty: {
    backgroundColor: 'rgba(200, 164, 93, 0.18)',
  },
});
