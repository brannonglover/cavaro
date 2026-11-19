import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AccentCard from '../ui/AccentCard';
import { borderRadius, colors, spacing, typography } from '../../theme';

const LEAD_MIN = 40;
const LEAD_MAX = 190;
const COLLAPSE_AFTER = 260;
const COLLAPSED_LINES = 4;

const SENTENCE_BREAK = new RegExp(`^(.{${LEAD_MIN},${LEAD_MAX}}?[.!?]["”’)]?)\\s+(.+)$`);

/**
 * Catalog prose reads better as a pull-quote lead plus supporting copy, so the
 * first sentence is promoted when one exists at a usable length.
 */
export function splitCatalogNotes(text) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return { lead: '', rest: '' };

  const match = clean.match(SENTENCE_BREAK);
  if (match) return { lead: match[1], rest: match[2] };
  if (clean.length <= LEAD_MAX) return { lead: clean, rest: '' };
  return { lead: '', rest: clean };
}

export default function CatalogNotesCard({ text, source, style }) {
  const [expanded, setExpanded] = useState(false);
  const { lead, rest } = splitCatalogNotes(text);
  if (!lead && !rest) return null;

  const collapsible = rest.length > COLLAPSE_AFTER;

  return (
    <AccentCard
      accentColor={colors.goldMuted}
      variant="default"
      watermarkIcon="format-quote-close"
      watermarkColor="rgba(200, 164, 93, 0.09)"
      style={style}
      bodyStyle={styles.body}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons
            name="book-open-page-variant-outline"
            size={18}
            color={colors.gold}
          />
        </View>
        <View style={styles.heading}>
          <Text style={styles.label}>Catalog notes</Text>
          <Text style={styles.attribution}>{source ? `From ${source}` : 'From the brand'}</Text>
        </View>
      </View>

      {lead ? (
        <View style={styles.leadRow}>
          <View style={styles.leadRule} />
          <Text style={styles.lead}>{lead}</Text>
        </View>
      ) : null}

      {rest ? (
        <Text
          style={[styles.rest, lead ? styles.restSpaced : null]}
          numberOfLines={collapsible && !expanded ? COLLAPSED_LINES : undefined}
        >
          {rest}
        </Text>
      ) : null}

      {collapsible ? (
        <Pressable
          onPress={() => setExpanded((prev) => !prev)}
          hitSlop={8}
          style={styles.moreRow}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show less catalog notes' : 'Read more catalog notes'}
        >
          <Text style={styles.moreText}>{expanded ? 'Show less' : 'Read more'}</Text>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.gold}
          />
        </Pressable>
      ) : null}
    </AccentCard>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(200, 164, 93, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    ...typography.label,
    color: colors.goldMuted,
  },
  attribution: {
    ...typography.caption,
    color: colors.textSubtle,
    marginTop: 2,
  },
  leadRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  leadRule: {
    width: 2,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(200, 164, 93, 0.45)',
  },
  lead: {
    flex: 1,
    fontSize: 17,
    lineHeight: 27,
    fontWeight: '500',
    letterSpacing: 0.1,
    color: colors.text,
  },
  rest: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 24,
  },
  restSpaced: {
    marginTop: spacing.md,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  moreText: {
    ...typography.caption,
    color: colors.gold,
    fontWeight: '600',
  },
});
