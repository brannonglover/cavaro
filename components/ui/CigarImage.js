import { Image, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { getWrapperPalette } from '../../lib/wrapperColors';
import { colors } from '../../theme';

const VARIANTS = {
  hero: {
    iconSize: 52,
    iconOpacity: 0.32,
  },
  thumbnail: {
    iconSize: 24,
    iconOpacity: 0.22,
  },
  inventory: {
    iconSize: 28,
    iconOpacity: 0.38,
  },
};

function WrapperGradient({ palette, style }) {
  return (
    <Svg style={style} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="wrapperGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={palette.dark} />
          <Stop offset="45%" stopColor={palette.mid} />
          <Stop offset="100%" stopColor={palette.light} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#wrapperGrad)" />
    </Svg>
  );
}

function WrapperFallback({ wrapper, variant = 'thumbnail', style }) {
  const config = VARIANTS[variant] ?? VARIANTS.thumbnail;
  const palette = getWrapperPalette(wrapper);

  return (
    <View style={[styles.fallback, style]}>
      <WrapperGradient palette={palette} style={StyleSheet.absoluteFill} />
      <View style={styles.smokeAccent} pointerEvents="none">
        <MaterialCommunityIcons
          name="smoking"
          size={config.iconSize}
          color={palette.accent}
          style={{ opacity: config.iconOpacity }}
        />
      </View>
      <View style={styles.vignette} pointerEvents="none" />
    </View>
  );
}

function getFillStyle(variant) {
  if (variant === 'inventory') return styles.inventoryFill;
  if (variant === 'hero') return styles.heroFill;
  return styles.fill;
}

export default function CigarImage({
  imageUrl,
  wrapper,
  variant = 'thumbnail',
  style,
  imageStyle,
  resizeMode,
  fallbackIcon = 'smoking',
}) {
  const resolvedResizeMode = resizeMode ?? 'cover';

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[styles.image, getFillStyle(variant), style, imageStyle]}
        resizeMode={resolvedResizeMode}
      />
    );
  }

  if (wrapper?.trim()) {
    return (
      <WrapperFallback
        wrapper={wrapper}
        variant={variant}
        style={[getFillStyle(variant), style]}
      />
    );
  }

  const config = VARIANTS[variant] ?? VARIANTS.thumbnail;

  return (
    <View style={[styles.iconFallback, getFillStyle(variant), style]}>
      <MaterialCommunityIcons
        name={fallbackIcon}
        size={config.iconSize}
        color={colors.goldMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surfaceLight,
  },
  fill: {
    flex: 1,
    alignSelf: 'stretch',
  },
  inventoryFill: {
    ...StyleSheet.absoluteFillObject,
  },
  heroFill: {
    ...StyleSheet.absoluteFillObject,
  },
  fallback: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceLight,
  },
  smokeAccent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 11, 9, 0.12)',
  },
  iconFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLight,
  },
});
