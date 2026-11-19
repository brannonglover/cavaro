import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCigarImagePresentation } from '../../hooks/useResolvedCigarImage';
import { getWrapperPalette } from '../../lib/wrapperColors';
import { colors } from '../../theme';

/** Card rails: cap through the primary band and a little wrapper below. */
const HEAD_FOCUS_FRACTION = 0.58;

const VARIANTS = {
  hero: {
    iconSize: 52,
    iconOpacity: 0.32,
    focus: 'head',
  },
  thumbnail: {
    iconSize: 24,
    iconOpacity: 0.22,
    focus: 'head',
  },
  inventory: {
    iconSize: 28,
    iconOpacity: 0.38,
    focus: 'head',
  },
  full: {
    iconSize: 52,
    iconOpacity: 0.32,
    focus: 'full',
  },
};

function WrapperGradient({ palette, style }) {
  return (
    <View style={[style, { backgroundColor: palette.mid }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.dark, opacity: 0.62 }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.light, opacity: 0.28 }]} />
    </View>
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
  if (variant === 'hero' || variant === 'full') return styles.heroFill;
  return styles.fill;
}

/**
 * Manual scale/position so card rails can frame the cap and bands while the
 * full-screen viewer shows the entire stick.
 */
function FramedProductImage({ uri, focus, rotate90, style }) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [natural, setNatural] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled) setNatural({ width, height });
      },
      () => {
        if (!cancelled) setNatural({ width: 0, height: 0 });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const contentW = rotate90 ? natural.height : natural.width;
  const contentH = rotate90 ? natural.width : natural.height;
  let frame = null;

  if (box.width > 0 && contentW > 0 && contentH > 0) {
    let scale;
    let top;
    if (focus === 'full') {
      scale = Math.min(box.width / contentW, box.height / contentH);
      top = null;
    } else {
      const scaleW = box.width / contentW;
      const scaleHead = box.height / (contentH * HEAD_FOCUS_FRACTION);
      // Use the smaller scale so wide product photos don't zoom past the head
      // region — Math.max let width-filling win and cropped to just the tip.
      scale = Math.min(scaleW, scaleHead);
      top = 0;
    }
    const dispW = contentW * scale;
    const dispH = contentH * scale;
    const left = (box.width - dispW) / 2;
    const resolvedTop = top ?? (box.height - dispH) / 2;

    if (rotate90) {
      const elW = dispH;
      const elH = dispW;
      frame = {
        width: elW,
        height: elH,
        left: left + dispW / 2 - elW / 2,
        top: resolvedTop + dispH / 2 - elH / 2,
        transform: [{ rotate: '90deg' }],
      };
    } else {
      frame = {
        width: dispW,
        height: dispH,
        left,
        top: resolvedTop,
      };
    }
  }

  return (
    <View
      style={[style, styles.clip, styles.frame]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width !== box.width || height !== box.height) {
          setBox({ width, height });
        }
      }}
    >
      {frame ? (
        <Image
          source={{ uri }}
          resizeMode="stretch"
          style={[styles.framedImage, frame]}
        />
      ) : (
        <Image source={{ uri }} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
      )}
    </View>
  );
}

export default function CigarImage({
  imageUrl,
  wrapper,
  variant = 'thumbnail',
  style,
  imageStyle: _imageStyle,
  focus,
  fallbackIcon = 'smoking',
}) {
  const config = VARIANTS[variant] ?? VARIANTS.thumbnail;
  const resolvedFocus = focus ?? config.focus ?? 'head';
  const presentation = useCigarImagePresentation(imageUrl);
  const fill = [styles.image, getFillStyle(variant), style];

  if (imageUrl) {
    return (
      <FramedProductImage
        uri={imageUrl}
        focus={resolvedFocus}
        rotate90={presentation.rotate90}
        style={fill}
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
    backgroundColor: colors.surface,
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
  clip: {
    overflow: 'hidden',
  },
  frame: {
    backgroundColor: colors.surface,
  },
  framedImage: {
    position: 'absolute',
  },
  fallback: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surface,
  },
});
