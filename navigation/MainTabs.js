import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../theme';
import { SwipeableTabWrapper } from '../components/SwipeableTabWrapper';
import { cavaroTabBarStyle, TAB_BAR_CONTENT_HEIGHT } from './CavaroTabBar';
import CavaroStack from './CavaroStack';
import HomeStack from './HomeStack';
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
  function SwipeableScreen(props) {
    return (
      <SwipeableTabWrapper>
        <Screen {...props} />
      </SwipeableTabWrapper>
    );
  }
  SwipeableScreen.displayName = `Swipeable(${Screen.displayName || Screen.name || 'Screen'})`;
  return SwipeableScreen;
}

// Stable identities — creating these inside render remounts nested navigators.
const SwipeableHomeStack = withSwipe(HomeStack);
const SwipeableCavaroStack = withSwipe(CavaroStack);
const SwipeableCollection = withSwipe(Collection);
const SwipeableMyTaste = withSwipe(MyTaste);
const SwipeableJournal = withSwipe(Journal);

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
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 8) + 12 : 0;

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        sceneContainerStyle: { backgroundColor: colors.background },
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: [
          cavaroTabBarStyle.bar,
          Platform.OS === 'android' && {
            height: TAB_BAR_CONTENT_HEIGHT + bottomPadding,
            paddingBottom: bottomPadding,
          },
        ],
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
        component={SwipeableHomeStack}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: tabIcon('Home'),
        }}
      />
      <Tab.Screen
        name="Humidors"
        component={SwipeableCavaroStack}
        listeners={({ navigation }) => ({
          // Home / Search deep-link into AddCigar and leave that nested route
          // sticky on this tab — always land on the inventory list on tab press.
          tabPress: () => {
            navigation.navigate('Humidors', { screen: 'CavaroList' });
          },
        })}
        options={{
          tabBarLabel: 'Humidors',
          tabBarIcon: tabIcon('Humidors'),
          popToTopOnBlur: true,
        }}
      />
      <Tab.Screen
        name="Collection"
        component={SwipeableCollection}
        options={{
          tabBarLabel: 'Collection',
          tabBarIcon: tabIcon('Collection'),
        }}
      />
      <Tab.Screen
        name="MyTaste"
        component={SwipeableMyTaste}
        options={{
          tabBarLabel: 'My Taste',
          tabBarIcon: tabIcon('MyTaste'),
        }}
      />
      <Tab.Screen
        name="Journal"
        component={SwipeableJournal}
        options={{
          tabBarLabel: 'Journal',
          tabBarIcon: tabIcon('Journal'),
        }}
      />
    </Tab.Navigator>
  );
}
