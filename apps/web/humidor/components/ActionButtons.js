import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import HumidorStack from '../navigation/HumidorStack'
import ListIconDefault from './icons/ListIconDefault';
import ListIconFocused from './icons/ListIconFocused';
import colors from '../theme/colors'
import Favorites from '../pages/Favorites'
import Dislikes from '../pages/Dislikes'
import Pairing from '../pages/Pairing'
import { SwipeableTabWrapper } from './SwipeableTabWrapper'

const Tab = createBottomTabNavigator()

function SwipeableHumidor(props) {
  return (
    <SwipeableTabWrapper>
      <HumidorStack {...props} />
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
      <Tab.Screen
        name="Humidor"
        component={SwipeableHumidor}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center', width: 32, height: 32 }}>
              {focused ? (
                <ListIconFocused size={32} color={colors.primary} />
              ) : (
                <ListIconDefault size={32} color={colors.textSecondary} />
              )}
            </View>
          )
        }}
      />
      <Tab.Screen name="Favorites" component={SwipeableFavorites} options={{
        tabBarIcon: ({ focused }) => (
          <View style={{ alignItems: 'center', justifyContent: 'center', width: 32, height: 32 }}>
            <MaterialCommunityIcons
              name={focused ? 'star' : 'star-outline'}
              size={32}
              color={focused ? colors.primaryLight : colors.textSecondary}
            />
          </View>
        )
      }} />
      <Tab.Screen name="Dislikes" component={SwipeableDislikes} options={{
        tabBarIcon: ({ focused }) => (
          <View style={{ alignItems: 'center', justifyContent: 'center', width: 32, height: 32 }}>
            <MaterialCommunityIcons
              name="cigar-off"
              size={32}
              color={focused ? colors.dislike : colors.textSecondary}
            />
          </View>
        )
      }} />
      <Tab.Screen name="Pairing" component={SwipeablePairing} options={{
        tabBarIcon: ({ focused }) => (
          <View style={{ alignItems: 'center', justifyContent: 'center', width: 32, height: 32 }}>
            <MaterialCommunityIcons
              name="glass-cocktail"
              size={32}
              color={focused ? colors.primary : colors.textSecondary}
            />
          </View>
        )
      }} />
    </Tab.Navigator>
  )
}