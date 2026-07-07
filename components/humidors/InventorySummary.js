import { StyleSheet, View } from 'react-native';
import { CavaroText } from '../ui';
import { spacing } from '../../theme';

export default function InventorySummary({ title, metaParts = [], style }) {
  return (
    <View style={[styles.wrap, style]}>
      <CavaroText variant="sectionTitle">{title}</CavaroText>
      {metaParts.length > 0 ? (
        <CavaroText variant="body" tone="muted" style={styles.meta}>
          {metaParts.join('  •  ')}
        </CavaroText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  meta: {
    marginTop: spacing.xs,
  },
});
