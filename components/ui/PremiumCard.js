import { StyleSheet, View } from 'react-native';
import { colors, radius, shadows, spacing } from '../../theme';
import PressableScale from './PressableScale';

const VARIANTS = {
  default: {
    backgroundColor: colors.surfaceElevated,
    borderColor: 'rgba(143, 116, 64, 0.35)',
    ...shadows.card,
  },
  elevated: {
    backgroundColor: colors.surfaceElevated,
    borderColor: 'rgba(143, 116, 64, 0.45)',
    ...shadows.elevated,
  },
  warm: {
    backgroundColor: colors.surfaceWarm,
    borderColor: 'rgba(143, 116, 64, 0.4)',
    ...shadows.card,
  },
  subtle: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...shadows.cardSubtle,
  },
};

export default function PremiumCard({
  children,
  onPress,
  style,
  contentStyle,
  variant = 'default',
  padding,
  scaleTo = 0.985,
  accessibilityLabel,
}) {
  const shellStyle = [styles.shell, VARIANTS[variant], style];
  const innerStyle = [
    padding != null ? { padding } : styles.padding,
    contentStyle,
  ];
  const content = <View style={innerStyle}>{children}</View>;

  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        scaleTo={scaleTo}
        style={shellStyle}
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </PressableScale>
    );
  }

  return <View style={shellStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  padding: {
    padding: spacing.lg,
  },
});
