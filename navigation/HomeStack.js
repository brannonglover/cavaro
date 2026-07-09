import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Home from '../pages/Home';
import CigarDetail from '../pages/CigarDetail';
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
    </Stack.Navigator>
  );
}
