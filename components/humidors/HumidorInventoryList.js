import { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MarkSmokedReviewModal from '../MarkSmokedReviewModal';
import MoveCigarModal from '../MoveCigarModal';
import StartCellaringModal from '../StartCellaringModal';
import { EmptyState } from '../ui';
import { markCigarSmokedWithJournal } from '../../db';
import { hapticSuccess } from '../../lib/haptics';
import { trackEvent } from '../../lib/analytics';
import { useAuth } from '../../context/AuthContext';
import HumidorInventoryCard from './HumidorInventoryCard';
import { colors, spacing, typography } from '../../theme';

function SwipeActions({ onSmoke, onMove, onEdit, onClose }) {
  return (
    <View style={styles.actions}>
      <Pressable
        style={[styles.action, styles.actionSmoke]}
        onPress={() => {
          onClose?.();
          onSmoke?.();
        }}
      >
        <MaterialCommunityIcons name="fire" size={20} color={colors.text} />
        <Text style={styles.actionText}>Smoke</Text>
      </Pressable>
      <Pressable
        style={[styles.action, styles.actionMove]}
        onPress={() => {
          onClose?.();
          onMove?.();
        }}
      >
        <MaterialCommunityIcons name="swap-horizontal" size={20} color={colors.text} />
        <Text style={styles.actionText}>Move</Text>
      </Pressable>
      <Pressable
        style={[styles.action, styles.actionEdit]}
        onPress={() => {
          onClose?.();
          onEdit?.();
        }}
      >
        <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.text} />
        <Text style={styles.actionText}>Edit</Text>
      </Pressable>
    </View>
  );
}

export default function HumidorInventoryList({
  cigars = [],
  cellaringByCigarId = {},
  header,
  bottomPadding = 0,
  humidorId,
  onEditCigar,
  onInventoryChange,
  onAddCigar,
}) {
  const { user } = useAuth();
  const [smokedModalCigar, setSmokedModalCigar] = useState(null);
  const [moveModalCigar, setMoveModalCigar] = useState(null);
  const [cellaringModalCigar, setCellaringModalCigar] = useState(null);

  const handleMarkSmokedSave = async (review) => {
    if (!smokedModalCigar) return;
    try {
      await markCigarSmokedWithJournal({
        cigarId: smokedModalCigar.id,
        userId: user?.id,
        entry: review,
      });
      trackEvent('cigar_smoked', {
        rating: review.rating,
        would_buy_again: review.wouldBuyAgain,
      });
      hapticSuccess();
      setSmokedModalCigar(null);
      onInventoryChange?.();
    } catch (error) {
      Alert.alert('Could not save', error.message || 'Please try again.');
    }
  };

  const renderEmpty = () => (
    <EmptyState
      icon="archive-outline"
      title="Your humidor is waiting."
      message="Add your first cigar and start building your collection."
      actionLabel="Add Cigar"
      onAction={onAddCigar}
      style={styles.empty}
    />
  );

  const renderItem = ({ item }) => (
    <Swipeable
      friction={2}
      rightThreshold={40}
      renderRightActions={(_, __, swipeable) => (
        <SwipeActions
          onSmoke={() => setSmokedModalCigar(item)}
          onMove={() => setMoveModalCigar(item)}
          onEdit={() => onEditCigar?.(item)}
          onClose={() => swipeable.close()}
        />
      )}
    >
      <HumidorInventoryCard
        cigar={item}
        onMarkSmoked={() => setSmokedModalCigar(item)}
        onMove={() => setMoveModalCigar(item)}
        onStartCellaring={() => setCellaringModalCigar(item)}
      />
    </Swipeable>
  );

  return (
    <>
      <FlatList
        data={cigars}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.content,
          cigars.length === 0 && styles.emptyContent,
          bottomPadding > 0 && { paddingBottom: bottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      />

      <MarkSmokedReviewModal
        visible={!!smokedModalCigar}
        cigar={smokedModalCigar}
        onSave={handleMarkSmokedSave}
        onCancel={() => setSmokedModalCigar(null)}
      />
      <MoveCigarModal
        visible={!!moveModalCigar}
        cigar={moveModalCigar}
        currentHumidorId={moveModalCigar?.humidor_id ?? humidorId}
        onMoved={() => {
          setMoveModalCigar(null);
          onInventoryChange?.();
        }}
        onCancel={() => setMoveModalCigar(null)}
      />
      <StartCellaringModal
        visible={!!cellaringModalCigar}
        cigar={cellaringModalCigar}
        humidorId={cellaringModalCigar?.humidor_id ?? humidorId}
        onSaved={() => {
          setCellaringModalCigar(null);
          onInventoryChange?.();
        }}
        onCancel={() => setCellaringModalCigar(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  emptyContent: {
    flexGrow: 1,
  },
  empty: {
    minHeight: 280,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: spacing.md,
  },
  action: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  actionSmoke: {
    backgroundColor: colors.surfaceWarm,
  },
  actionMove: {
    backgroundColor: colors.surfaceLight,
  },
  actionEdit: {
    backgroundColor: colors.surfaceElevated,
  },
  actionText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
});
