import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AccountMenu from '../AccountMenu';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';

const logo = require('../../assets/logo-wd.png');

const SIDE_SLOT_WIDTH = 44;

export default function HomeHeader({ greeting, onAddCigar, style }) {
  const { user, supabase } = useAuth();

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.header}>
        <View style={styles.sideSlot}>
          {user ? (
            <AccountMenu
              onSignOut={() => supabase?.auth.signOut()}
              triggerStyle={styles.menuTrigger}
            >
              <MaterialCommunityIcons name="menu" size={26} color={colors.textMuted} />
            </AccountMenu>
          ) : null}
        </View>

        <Image
          source={logo}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Cavaro"
        />

        <View style={styles.sideSlot}>
          <Pressable
            onPress={onAddCigar}
            style={styles.addTrigger}
            accessibilityLabel="Add cigar"
            hitSlop={8}
          >
            <MaterialCommunityIcons name="plus" size={30} color={colors.gold} />
          </Pressable>
        </View>
      </View>
      {greeting ? <Text style={styles.greeting}>{greeting}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
  },
  sideSlot: {
    width: SIDE_SLOT_WIDTH,
    alignItems: 'center',
  },
  menuTrigger: {
    padding: 0,
    width: SIDE_SLOT_WIDTH,
    height: SIDE_SLOT_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTrigger: {
    width: SIDE_SLOT_WIDTH,
    height: SIDE_SLOT_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    flex: 1,
    height: 88,
  },
  greeting: {
    ...typography.sectionTitle,
    color: colors.goldBright,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
