import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBarHeight } from '../../navigation/useTabBarHeight';
import { colors, spacing } from '../../theme';

export default function ScreenContainer({
  children,
  scroll = false,
  padded = true,
  style,
  contentContainerStyle,
}) {
  const paddingStyle = padded ? styles.padded : null;
  const tabBarHeight = useTabBarHeight();

  if (scroll) {
    return (
      <SafeAreaView style={[styles.root, style]} edges={['top', 'left', 'right']} collapsable={false}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            paddingStyle,
            contentContainerStyle,
            tabBarHeight > 0 && { paddingBottom: tabBarHeight + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, style]} edges={['top', 'left', 'right']} collapsable={false}>
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
