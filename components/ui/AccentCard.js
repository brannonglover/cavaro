import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PremiumCard from './PremiumCard';

export default function AccentCard({
  accentColor,
  variant = 'elevated',
  watermarkIcon,
  watermarkColor = 'rgba(200, 164, 93, 0.12)',
  onPress,
  style,
  bodyStyle,
  children,
  padding = 0,
}) {
  return (
    <PremiumCard variant={variant} onPress={onPress} style={[styles.card, style]} padding={padding}>
      {accentColor ? (
        <View style={[styles.accent, { backgroundColor: accentColor }]} />
      ) : null}
      {watermarkIcon ? (
        <View style={styles.watermark} pointerEvents="none">
          <MaterialCommunityIcons name={watermarkIcon} size={48} color={watermarkColor} />
        </View>
      ) : null}
      <View style={[styles.body, bodyStyle]}>{children}</View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  accent: {
    height: 3,
    width: '100%',
  },
  watermark: {
    position: 'absolute',
    right: -2,
    top: 12,
  },
  body: {
    position: 'relative',
  },
});
