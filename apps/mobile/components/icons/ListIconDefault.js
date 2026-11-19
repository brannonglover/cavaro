import React from 'react';
import Svg, { Rect } from 'react-native-svg';

/**
 * List icon - default/unfocused state
 * Mimics the cigar list cards: stacked rounded rectangles
 */
export default function ListIconDefault({ size = 32, color = '#b8a99a' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Top card */}
      <Rect
        x={4}
        y={2}
        width={24}
        height={10}
        rx={3}
        ry={3}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
      />
      {/* Bottom card */}
      <Rect
        x={4}
        y={16}
        width={24}
        height={10}
        rx={3}
        ry={3}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
      />
    </Svg>
  );
}
