import { Pressable } from 'react-native';
import { hapticSelection } from '../lib/haptics';

export default function TabBarButton({ onPress, style, children, ...rest }) {
  return (
    <Pressable
      {...rest}
      onPress={(event) => {
        hapticSelection();
        onPress?.(event);
      }}
      style={({ pressed }) => [style, pressed && { opacity: 0.82, transform: [{ scale: 0.94 }] }]}
    >
      {children}
    </Pressable>
  );
}
