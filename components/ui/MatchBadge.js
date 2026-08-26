import { MATCH_LEVELS } from '../../models/tasteProfile';
import CavaroBadge from './CavaroBadge';

export { MATCH_LEVELS };

const LEVEL_VARIANTS = {
  'Excellent Match': 'gold',
  'Good Match': 'success',
  'Mixed Experience': 'warning',
  'Needs Another Chance': 'muted',
  'Unlikely Match': 'danger',
};

export default function MatchBadge({ level, label, style, textStyle }) {
  return (
    <CavaroBadge
      label={label || level}
      variant={LEVEL_VARIANTS[level] ?? 'default'}
      style={style}
      textStyle={textStyle}
    />
  );
}
