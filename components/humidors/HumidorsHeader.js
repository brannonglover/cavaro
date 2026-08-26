import { StyleSheet, View } from 'react-native';
import { CavaroText } from '../ui';
import { spacing } from '../../theme';

export default function HumidorsHeader({ cigarCountLabel, style }) {
  const subtitle = cigarCountLabel
    ? `Current inventory  •  ${cigarCountLabel}`
    : 'Current inventory';

  return (
    <View style={[styles.header, style]}>
      <View style={styles.copy}>
        <CavaroText variant="title">Humidors</CavaroText>
        <CavaroText variant="body" tone="muted" style={styles.subtitle}>
          {subtitle}
        </CavaroText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  copy: {
    flex: 1,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
});
