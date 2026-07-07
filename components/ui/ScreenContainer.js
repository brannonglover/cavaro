import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../theme';

export default function ScreenContainer({
  children,
  scroll = false,
  padded = true,
  style,
  contentContainerStyle,
}) {
  const paddingStyle = padded ? styles.padded : null;

  if (scroll) {
    return (
      <SafeAreaView style={[styles.root, style]}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, paddingStyle, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, style]}>
      <View style={[styles.content, paddingStyle, contentContainerStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
});
