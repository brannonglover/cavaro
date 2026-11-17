import { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../theme/colors';
import getUserFirstName from '../lib/getUserFirstName';

/**
 * Circular profile image with a graceful ladder of fallbacks:
 * photo -> initial -> person glyph.
 *
 * The initial comes from getUserFirstName, which already resolves a display
 * name out of user_metadata, the identity provider, or the email local part —
 * so an account that never set a name still shows something personal.
 *
 * allowFontScaling is off for the initial only. It is a glyph sized to the
 * circle rather than body copy, and letting it scale pushed it out of a fixed
 * circle at larger Dynamic Type settings.
 */
export default function Avatar({ user, uri, size = 32, style }) {
  const [failed, setFailed] = useState(false);

  const source = uri ?? user?.user_metadata?.avatar_url ?? null;
  const name = getUserFirstName(user);
  const initial = name ? name.charAt(0).toUpperCase() : null;

  const dimensions = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (source && !failed) {
    return (
      <Image
        source={{ uri: source }}
        style={[styles.image, dimensions, style]}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View style={[styles.fallback, dimensions, style]}>
      {initial ? (
        <Text
          allowFontScaling={false}
          style={[styles.initial, { fontSize: Math.round(size * 0.45) }]}
        >
          {initial}
        </Text>
      ) : (
        <MaterialCommunityIcons
          name="account"
          size={Math.round(size * 0.62)}
          color={colors.textMuted}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  initial: {
    color: colors.primary,
    fontWeight: '600',
  },
});
