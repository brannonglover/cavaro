import { useContext } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { colors, spacing } from '../../theme';

export default function CavaroScreen({
  children,
  scroll = false,
  padded = true,
  tabBarPadding = false,
  bottomPadding,
  style,
  contentContainerStyle,
}) {
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const resolvedBottomPadding = tabBarPadding
    ? (bottomPadding ?? tabBarHeight)
    : (bottomPadding ?? 0);

  const horizontalPadding = padded ? styles.padded : null;
  const bottomStyle = resolvedBottomPadding > 0
    ? { paddingBottom: resolvedBottomPadding }
    : null;

  if (scroll) {
    return (
      <SafeAreaView style={[styles.root, style]} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            horizontalPadding,
            bottomStyle,
            contentContainerStyle,
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
    <SafeAreaView style={[styles.root, style]} edges={['top', 'left', 'right']}>
      <View
        style={[
          styles.content,
          horizontalPadding,
          bottomStyle,
          contentContainerStyle,
        ]}
      >
        {children}
      </View>
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
