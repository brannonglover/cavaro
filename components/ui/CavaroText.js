import { StyleSheet, Text } from 'react-native';
import { colors, typography } from '../../theme';

export const CAVARO_TEXT_VARIANTS = [
  'hero',
  'title',
  'sectionTitle',
  'body',
  'caption',
  'label',
  'metric',
];

const VARIANT_STYLES = StyleSheet.create({
  hero: typography.hero,
  title: typography.title,
  sectionTitle: typography.sectionTitle,
  body: typography.body,
  caption: typography.caption,
  label: typography.label,
  metric: typography.metric,
});

const DEFAULT_COLORS = {
  hero: colors.text,
  title: colors.text,
  sectionTitle: colors.text,
  body: colors.text,
  caption: colors.textMuted,
  label: colors.textMuted,
  metric: colors.text,
};

const TONE_COLORS = {
  default: null,
  muted: colors.textMuted,
  subtle: colors.textSubtle,
  gold: colors.gold,
  success: colors.success,
  danger: colors.danger,
};

export default function CavaroText({
  variant = 'body',
  tone = 'default',
  children,
  style,
  ...rest
}) {
  const resolvedColor = TONE_COLORS[tone] ?? DEFAULT_COLORS[variant];

  return (
    <Text
      style={[VARIANT_STYLES[variant], { color: resolvedColor }, style]}
      {...rest}
    >
      {children}
    </Text>
  );
}
