import { StyleSheet, View } from 'react-native';
import { CavaroText } from '../ui';
import { spacing } from '../../theme';

export default function InventorySummary({ title, metaParts = [], style }) {
  if (!title && metaParts.length === 0) return null;

  return (
    <View style={[styles.wrap, style]}>
      {title ? <CavaroText variant="sectionTitle">{title}</CavaroText> : null}
      {metaParts.length > 0 ? (
        <CavaroText variant="body" tone="muted" style={[styles.meta, !title && styles.metaAlone]}>
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
  metaAlone: {
    marginTop: 0,
  },
});
