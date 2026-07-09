import { StyleSheet, View } from 'react-native';
import { StatCard } from '../ui';
import { spacing } from '../../theme';

function formatCount(value) {
  return Number(value ?? 0).toLocaleString();
}

const HOME_STATS = [
  { key: 'inventory', label: 'In Humidor', icon: 'fridge-outline', prop: 'inventoryCount', accent: 'gold' },
  { key: 'smoked', label: 'Smoked', icon: 'cigar', prop: 'smokedCount', accent: 'amber' },
  { key: 'cellared', label: 'Cellared', icon: 'barrel', prop: 'cellaredCount', accent: 'tobacco' },
  { key: 'brands', label: 'Brands', icon: 'tag-multiple-outline', prop: 'brandCount', accent: 'sage' },
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
    <View style={[styles.grid, style]}>
      {HOME_STATS.map(({ key, label, icon, prop, accent }) => (
        <StatCard
          key={key}
          layout="collection"
          highlight={false}
          icon={icon}
          accent={accent}
          label={label}
          value={formatCount(counts[prop])}
          style={styles.stat}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  stat: {
    width: '48%',
    flexGrow: 1,
    flexShrink: 1,
  },
});
