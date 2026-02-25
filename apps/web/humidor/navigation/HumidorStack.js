import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Humidor from '../pages/Humidor';
import AddCigar from '../pages/AddCigar';
import colors from '../theme/colors';

const Stack = createNativeStackNavigator();

export default function HumidorStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.screenBg },
      }}
    >
      <Stack.Screen name="HumidorList" component={Humidor} />
      <Stack.Screen name="AddCigar" component={AddCigar} />
    </Stack.Navigator>
  );
}
