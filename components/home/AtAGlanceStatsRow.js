import { StyleSheet, View } from 'react-native';
import { StatCard } from '../ui';
import { spacing } from '../../theme';

function formatCount(value) {
  return Number(value ?? 0).toLocaleString();
}

const GLANCE_STATS = [
  { key: 'inventory', label: 'In Humidor', icon: 'archive-outline', prop: 'inventoryCount' },
  { key: 'smoked', label: 'Smoked', icon: 'cigar', prop: 'smokedCount' },
  { key: 'cellared', label: 'Cellared', icon: 'barrel', prop: 'cellaredCount' },
  { key: 'brands', label: 'Brands', icon: 'flag-outline', prop: 'brandCount' },
];

export default function AtAGlanceStatsRow({
  inventoryCount,
  cellaredCount,
  smokedCount,
  brandCount,
  style,
}) {
  const counts = { inventoryCount, cellaredCount, smokedCount, brandCount };

  return (
    <View style={[styles.row, style]}>
      {GLANCE_STATS.map(({ key, label, icon, prop }) => (
        <StatCard
          key={key}
          layout="glance"
          highlight={false}
          icon={icon}
          label={label}
          value={formatCount(counts[prop])}
          style={styles.stat}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  stat: {
    flex: 1,
    minWidth: 0,
  },
});
