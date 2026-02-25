import React from 'react';
import Svg, { Rect, Line } from 'react-native-svg';

/**
 * List icon - focused/active state
 * Mimics the cigar list with one card showing expanded content (divider line)
 */
export default function ListIconFocused({ size = 32, color = '#c4a574' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Top card - collapsed */}
      <Rect
        x={4}
        y={2}
        width={24}
        height={8}
        rx={3}
        ry={3}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
      />
      {/* Bottom card - expanded with divider */}
      <Rect
        x={4}
        y={14}
        width={24}
        height={14}
        rx={3}
        ry={3}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
      />
      {/* Divider line - represents expanded details section */}
      <Line
        x1={8}
        y1={22}
        x2={24}
        y2={22}
        stroke={color}
        strokeWidth={1}
        strokeOpacity={0.7}
      />
    </Svg>
  );
}
