import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Home from '../pages/Home';
import CigarDetail from '../pages/CigarDetail';
import TasteSearch from '../pages/TasteSearch';
import TasteSearchDetail from '../pages/TasteSearchDetail';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="HomeMain" component={Home} />
      <Stack.Screen name="CigarDetail" component={CigarDetail} />
      <Stack.Screen name="TasteSearch" component={TasteSearch} />
      <Stack.Screen name="TasteSearchDetail" component={TasteSearchDetail} />
    </Stack.Navigator>
  );
}
