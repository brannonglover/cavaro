import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CigarList from '../components/CigarList';
import AddCigarBtn from '../components/AddCigarBtn';
import {
  HumidorSelector,
  HumidorsHeader,
  InventorySegmentControl,
  InventorySummary,
} from '../components/humidors';
import { EmptyState } from '../components/ui';
import { createHumidor, getHumidors } from '../db';
import {
  buildInventorySummary,
  HUMIDOR_FILTER_ALL,
  INVENTORY_SEGMENT_OPTIONS,
  INVENTORY_SEGMENTS,
} from '../lib/humidorsScreen';
import { useTabBarHeight } from '../navigation/useTabBarHeight';
import { colors, spacing } from '../theme';

const LIST_HORIZONTAL_PADDING = 16;

const SEGMENT_IDS = new Set(Object.values(INVENTORY_SEGMENTS));

export default function Cavaro({ navigation, route }) {
  const tabBarHeight = useTabBarHeight();
  const [humidors, setHumidors] = useState([]);
  const [humidorFilterId, setHumidorFilterId] = useState(HUMIDOR_FILTER_ALL);
  const [segment, setSegment] = useState(INVENTORY_SEGMENTS.ALL);

  const hasMultipleHumidors = humidors.length > 1;
  const listHumidorId = hasMultipleHumidors ? humidorFilterId : humidors[0]?.id ?? null;
  const addCigarHumidorId = humidorFilterId ?? humidors[0]?.id ?? null;

  const summary = useMemo(
    () => buildInventorySummary(humidors, hasMultipleHumidors ? humidorFilterId : humidors[0]?.id),
    [humidorFilterId, hasMultipleHumidors, humidors]
  );

  const refreshHumidors = useCallback(async () => {
    const nextHumidors = await getHumidors();
    setHumidors(nextHumidors);

    setHumidorFilterId((current) => {
      if (nextHumidors.length === 1) {
        return nextHumidors[0].id;
      }
      if (current != null && !nextHumidors.some((humidor) => humidor.id === current)) {
        return HUMIDOR_FILTER_ALL;
      }
      return current;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      const requestedSegment = route.params?.inventorySegment;
      if (requestedSegment && SEGMENT_IDS.has(requestedSegment)) {
        setSegment(requestedSegment);
        navigation.setParams({ inventorySegment: undefined });
      }
      refreshHumidors().catch(() => {});
    }, [navigation, refreshHumidors, route.params?.inventorySegment])
  );

  const openAddCigar = () => {
    navigation.navigate('AddCigar', { humidorId: addCigarHumidorId });
  };

  const handleAddHumidor = async () => {
    const existingNames = new Set(humidors.map((humidor) => humidor.name));
    let name = 'New Humidor';
    let suffix = 2;
    while (existingNames.has(name)) {
      name = `New Humidor ${suffix}`;
      suffix += 1;
    }

    try {
      await createHumidor(name);
      await refreshHumidors();
    } catch (error) {
      Alert.alert('Could not create humidor', error.message || 'Please try again.');
    }
  };

  if (humidors.length === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']} collapsable={false}>
        <View style={styles.headerBlock}>
          <HumidorsHeader cigarCountLabel={summary.cigarCountLabel} />
          <EmptyState
            icon="archive-outline"
            title="Create your first humidor"
            message="Add a humidor to start tracking your cigar inventory."
            actionLabel="Add Humidor"
            onAction={handleAddHumidor}
          />
        </View>
      </SafeAreaView>
    );
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      <HumidorsHeader cigarCountLabel={summary.cigarCountLabel} />

      <InventorySummary title={summary.title} metaParts={summary.metaParts} />

      {hasMultipleHumidors ? (
        <HumidorSelector
          humidors={humidors}
          selectedHumidorId={humidorFilterId}
          onChange={setHumidorFilterId}
        />
      ) : null}

      <InventorySegmentControl
        options={INVENTORY_SEGMENT_OPTIONS}
        value={segment}
        onChange={setSegment}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']} collapsable={false}>
      <CigarList
        view="cavaro"
        inventoryMode
        humidorId={listHumidorId}
        inventorySegment={segment}
        listHeader={listHeader}
        onEditCigar={(cigar) => navigation.navigate('EditCigar', { cigar })}
        onInventoryChange={refreshHumidors}
        emptyActionLabel="Add Cigar"
        onEmptyAction={openAddCigar}
        bottomPadding={tabBarHeight + 88}
      />

      <AddCigarBtn onPress={openAddCigar} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBlock: {
    paddingTop: spacing.lg,
    paddingHorizontal: LIST_HORIZONTAL_PADDING,
  },
});
