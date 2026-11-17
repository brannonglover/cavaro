import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import CavaroTabBar from '../components/CavaroTabBar';
import HumidorIcon from '../components/icons/HumidorIcon';
import { SwipeableTabWrapper } from '../components/SwipeableTabWrapper';
import { colors } from '../theme';
import CavaroStack from './CavaroStack';
import HomeStack from './HomeStack';
import Collection from '../pages/Collection';
import MyTaste from '../pages/MyTaste';
import Journal from '../pages/Journal';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home: 'home',
  Collection: 'albums',
  MyTaste: 'sparkles',
  Journal: 'book',
};

function tabBarIcon(name) {
  const icon = TAB_ICONS[name];
  return ({ focused, color, size }) => (
    <Ionicons name={focused ? icon : `${icon}-outline`} color={color} size={size} />
  );
}

// No icon font has a real humidor, so this tab uses a custom glyph.
function humidorTabIcon({ focused, color, size }) {
  return <HumidorIcon filled={focused} color={color} size={size} />;
}

const renderTabBar = (props) => <CavaroTabBar {...props} />;

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
      tabBar={renderTabBar}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tab.Screen
        name="Home"
        component={SwipeableHomeStack}
        listeners={({ navigation }) => ({
          // My Taste deep-links into TasteSearch and leaves that nested route
          // sticky on this tab — always land on Home on tab press.
          tabPress: () => {
            navigation.navigate('Home', { screen: 'HomeMain' });
          },
        })}
        options={{
          title: 'Home',
          tabBarIcon: tabBarIcon('Home'),
        }}
      />
      <Tab.Screen
        name="Humidors"
        component={SwipeableCavaroStack}
        listeners={({ navigation }) => ({
          // Home / Taste Search deep-link into AddCigar and leave that nested route
          // sticky on this tab — always land on the inventory list on tab press.
          tabPress: () => {
            navigation.navigate('Humidors', { screen: 'CavaroList' });
          },
        })}
        options={{
          title: 'Humidors',
          tabBarIcon: humidorTabIcon,
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
