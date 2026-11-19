import { Pressable, StyleSheet, View } from 'react-native';
import CavaroText from './CavaroText';
import { hapticSelection } from '../../lib/haptics';
import { colors, radius, spacing } from '../../theme';

export default function SegmentedControl({ options, value, onChange, style }) {
  return (
    <View style={[styles.track, style]}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => {
              if (option.id === value) return;
              hapticSelection();
              onChange?.(option.id);
            }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <CavaroText
              variant="caption"
              tone={active ? 'gold' : 'muted'}
              style={active ? styles.labelActive : null}
            >
              {option.label}
            </CavaroText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  segmentActive: {
    backgroundColor: colors.surfaceWarm,
  },
  labelActive: {
    fontWeight: '600',
  },
});
