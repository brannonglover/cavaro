import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../theme';
import { SwipeableTabWrapper } from '../components/SwipeableTabWrapper';
import { cavaroTabBarStyle } from './CavaroTabBar';
import CavaroStack from './CavaroStack';
import Home from '../pages/Home';
import Collection from '../pages/Collection';
import MyTaste from '../pages/MyTaste';
import Journal from '../pages/Journal';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home: { focused: 'home', unfocused: 'home-outline' },
  Humidors: { focused: 'archive', unfocused: 'archive-outline' },
  Collection: { focused: 'view-grid', unfocused: 'view-grid-outline' },
  MyTaste: { focused: 'star-four-points', unfocused: 'star-four-points-outline' },
  Journal: { focused: 'notebook', unfocused: 'notebook-outline' },
};

function withSwipe(Screen) {
  return function SwipeableScreen(props) {
    return (
      <SwipeableTabWrapper>
        <Screen {...props} />
      </SwipeableTabWrapper>
    );
  };
}

function tabIcon(name) {
  return ({ focused, color }) => {
    const icons = TAB_ICONS[name];
    return (
      <MaterialCommunityIcons
        name={focused ? icons.focused : icons.unfocused}
        size={focused ? 24 : 22}
        color={color}
      />
    );
  };
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        sceneContainerStyle: { backgroundColor: colors.background },
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: cavaroTabBarStyle.bar,
        tabBarLabel: ({ focused, color, children }) => (
          <Text
            style={{
              color,
              fontSize: typography.caption.fontSize,
              lineHeight: typography.caption.lineHeight,
              fontWeight: focused ? '600' : '500',
              marginTop: spacing.xs,
            }}
          >
            {children}
          </Text>
        ),
        tabBarItemStyle: {
          paddingVertical: spacing.xs,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={withSwipe(Home)}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: tabIcon('Home'),
        }}
      />
      <Tab.Screen
        name="Humidors"
        component={withSwipe(CavaroStack)}
        options={{
          tabBarLabel: 'Humidors',
          tabBarIcon: tabIcon('Humidors'),
        }}
      />
      <Tab.Screen
        name="Collection"
        component={withSwipe(Collection)}
        options={{
          tabBarLabel: 'Collection',
          tabBarIcon: tabIcon('Collection'),
        }}
      />
      <Tab.Screen
        name="MyTaste"
        component={withSwipe(MyTaste)}
        options={{
          tabBarLabel: 'My Taste',
          tabBarIcon: tabIcon('MyTaste'),
        }}
      />
      <Tab.Screen
        name="Journal"
        component={withSwipe(Journal)}
        options={{
          tabBarLabel: 'Journal',
          tabBarIcon: tabIcon('Journal'),
        }}
      />
    </Tab.Navigator>
  );
}
