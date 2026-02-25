import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import HumidorStack from '../navigation/HumidorStack'
import ListIconDefault from './icons/ListIconDefault';
import ListIconFocused from './icons/ListIconFocused';
import colors from '../theme/colors'
import Favorites from '../pages/Favorites'
import Dislikes from '../pages/Dislikes'

const Tab = createBottomTabNavigator()

export function ActionButtons() {
  return (
    <Tab.Navigator
      screenOptions={{
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
        component={HumidorStack}
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
      <Tab.Screen name="Favorites" component={Favorites} options={{
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
      <Tab.Screen name="Dislikes" component={Dislikes} options={{
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
    </Tab.Navigator>
  )
}