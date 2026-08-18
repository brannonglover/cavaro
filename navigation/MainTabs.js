import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { SwipeableTabWrapper } from '../components/SwipeableTabWrapper';
import { colors } from '../theme';
import CavaroStack from './CavaroStack';
import HomeStack from './HomeStack';
import Collection from '../pages/Collection';
import MyTaste from '../pages/MyTaste';
import Journal from '../pages/Journal';

const Tab = createNativeBottomTabNavigator();

const TAB_ICONS = {
  Home: { sf: 'house', sfFilled: 'house.fill' },
  Humidors: { sf: 'archivebox', sfFilled: 'archivebox.fill' },
  Collection: { sf: 'square.grid.2x2', sfFilled: 'square.grid.2x2.fill' },
  MyTaste: { sf: 'sparkle', sfFilled: 'sparkle' },
  Journal: { sf: 'book', sfFilled: 'book.fill' },
};

function tabBarIcon(name) {
  const icon = TAB_ICONS[name];
  return ({ focused }) => ({ sfSymbol: focused ? icon.sfFilled : icon.sf });
}

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

export default function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      translucent
      hapticFeedbackEnabled
      labeled
      scrollEdgeAppearance="transparent"
      minimizeBehavior="never"
      tabBarActiveTintColor={colors.gold}
      tabBarInactiveTintColor={colors.textMuted}
      screenOptions={{
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tab.Screen
        name="Home"
        component={SwipeableHomeStack}
        options={{
          title: 'Home',
          tabBarIcon: tabBarIcon('Home'),
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
          title: 'Humidors',
          tabBarIcon: tabBarIcon('Humidors'),
        }}
      />
      <Tab.Screen
        name="Collection"
        component={SwipeableCollection}
        options={{
          title: 'Collection',
          tabBarIcon: tabBarIcon('Collection'),
        }}
      />
      <Tab.Screen
        name="MyTaste"
        component={SwipeableMyTaste}
        options={{
          title: 'My Taste',
          tabBarIcon: tabBarIcon('MyTaste'),
        }}
      />
      <Tab.Screen
        name="Journal"
        component={SwipeableJournal}
        options={{
          title: 'Journal',
          tabBarIcon: tabBarIcon('Journal'),
        }}
      />
    </Tab.Navigator>
  );
}
