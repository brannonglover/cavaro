import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { colors } from '../../theme';

/**
 * Lidded cigar box with a hygrometer dial on the front — the detail that
 * makes it read as a humidor rather than a generic box or archive.
 * Line weight matches Ionicons' outline set at tab-bar sizes.
 */
export default function HumidorIcon({ size = 24, color = colors.gold, filled = false }) {
  const stroke = 1.6;
  const dialColor = filled ? colors.background : color;

  return (
    // Keyed on `filled` so the SVG remounts: react-native-svg doesn't clear a
    // fill when it changes back to 'none', which left the icon stuck gold.
    <Svg key={filled ? 'filled' : 'outline'} width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Lid, overhanging the body slightly */}
      <Rect
        x={2.6}
        y={3.4}
        width={18.8}
        height={3.4}
        rx={1.2}
        stroke={color}
        strokeWidth={stroke}
        strokeLinejoin="round"
        fill={filled ? color : 'none'}
      />
      {/* Body, with a seam below the lid */}
      <Rect
        x={3.8}
        y={8.4}
        width={16.4}
        height={12.2}
        rx={1.6}
        stroke={color}
        strokeWidth={stroke}
        strokeLinejoin="round"
        fill={filled ? color : 'none'}
      />
      {/* Hygrometer dial and needle */}
      <Circle cx={12} cy={14.5} r={3.2} stroke={dialColor} strokeWidth={stroke} />
      <Line
        x1={12}
        y1={14.5}
        x2={13.6}
        y2={12.9}
        stroke={dialColor}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </Svg>
  );
}
