import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Cavaro from '../pages/Cavaro';
import AddCigar from '../pages/AddCigar';
import EditCigar from '../pages/EditCigar';
import Archive from '../pages/Archive';
import CigarDetail from '../pages/CigarDetail';
import TasteSearchDetail from '../pages/TasteSearchDetail';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

export default function CavaroStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="CavaroList" component={Cavaro} />
      <Stack.Screen name="Archive" component={Archive} />
      <Stack.Screen name="AddCigar" component={AddCigar} />
      <Stack.Screen name="EditCigar" component={EditCigar} />
      <Stack.Screen name="CigarDetail" component={CigarDetail} />
      <Stack.Screen name="TasteSearchDetail" component={TasteSearchDetail} />
    </Stack.Navigator>
  );
}
