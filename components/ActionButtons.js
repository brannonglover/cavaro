import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CavaroStack from '../navigation/CavaroStack'
import ListIconDefault from './icons/ListIconDefault';
import ListIconFocused from './icons/ListIconFocused';
import colors from '../theme/colors'
import Favorites from '../pages/Favorites'
import Dislikes from '../pages/Dislikes'
import Search from '../pages/Search'
import Pairing from '../pages/Pairing'
import { SwipeableTabWrapper } from './SwipeableTabWrapper'

const Tab = createBottomTabNavigator()

function SwipeableCavaro(props) {
  return (
    <SwipeableTabWrapper>
      <CavaroStack {...props} />
    </SwipeableTabWrapper>
  )
}

function SwipeableFavorites(props) {
  return (
    <SwipeableTabWrapper>
      <Favorites {...props} />
    </SwipeableTabWrapper>
  )
}

function SwipeableDislikes(props) {
  return (
    <SwipeableTabWrapper>
      <Dislikes {...props} />
    </SwipeableTabWrapper>
  )
}

function SwipeableSearch(props) {
  return (
    <SwipeableTabWrapper>
      <Search {...props} />
    </SwipeableTabWrapper>
  )
}

function SwipeablePairing(props) {
  return (
    <SwipeableTabWrapper>
      <Pairing {...props} />
    </SwipeableTabWrapper>
  )
}

export function ActionButtons() {
  return (
    <Tab.Navigator
      initialRouteName="Cavaro"
      screenOptions={{
        sceneContainerStyle: { backgroundColor: colors.screenBg },
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.cardBg,
          height: 90,
          borderTopWidth: 2,
          borderTopColor: colors.cardBorder,
          paddingTop: 12,
          shadowColor: colors.textPrimary,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
          elevation: 8,
        },
        tabBarItemStyle: {
          justifyContent: 'flex-end',
          paddingBottom: 8,
        },
        headerShown: false
      }}
    >
      <Tab.Screen name="Favorites" component={SwipeableFavorites} options={{
        tabBarIcon: ({ focused }) => (
          <View style={styles.tabIcon}>
            <MaterialCommunityIcons
              name={focused ? 'heart' : 'heart-outline'}
              size={36}
              color={focused ? colors.primaryLight : colors.textSecondary}
            />
          </View>
        )
      }} />
      <Tab.Screen name="Dislikes" component={SwipeableDislikes} options={{
        tabBarIcon: ({ focused }) => (
          <View style={styles.tabIcon}>
            <MaterialCommunityIcons
              name="cigar-off"
              size={36}
              color={focused ? colors.dislike : colors.textSecondary}
            />
          </View>
        )
      }} />
      <Tab.Screen
        name="Cavaro"
        component={SwipeableCavaro}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.humidorIconWrapper, focused && styles.humidorIconWrapperFocused]}>
              {focused ? (
                <ListIconFocused size={44} color={colors.primary} />
              ) : (
                <ListIconDefault size={44} color={colors.textSecondary} />
              )}
            </View>
          )
        }}
      />
      <Tab.Screen name="Search" component={SwipeableSearch} options={{
        tabBarIcon: ({ focused }) => (
          <View style={styles.tabIcon}>
            <MaterialCommunityIcons
              name="magnify"
              size={36}
              color={focused ? colors.primary : colors.textSecondary}
            />
          </View>
        )
      }} />
      <Tab.Screen name="Pairing" component={SwipeablePairing} options={{
        tabBarIcon: ({ focused }) => (
          <View style={styles.tabIcon}>
            <MaterialCommunityIcons
              name="glass-cocktail"
              size={36}
              color={focused ? colors.primary : colors.textSecondary}
            />
          </View>
        )
      }} />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  humidorIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.cardBorder,
    marginBottom: -8,
  },
  humidorIconWrapperFocused: {
    backgroundColor: 'rgba(196, 165, 116, 0.2)',
  },
})