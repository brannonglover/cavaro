import { SafeAreaView, StyleSheet, View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import CigarList from '../components/CigarList';
import { COLLECTIONS } from '../db';
import colors from '../theme/colors';

function Archive() {
  const navigation = useNavigation();
  const view = COLLECTIONS.ARCHIVE;

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Archive</Text>
            <Text style={styles.subtitle}>Smoked cigars awaiting your thoughts</Text>
          </View>
        </View>
        <CigarList
          view={view}
          onEditCigar={(cigar) => navigation.navigate('EditCigar', { cigar })}
        />
      </SafeAreaView>
    </View>
  );
}

export default Archive;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: {
    marginBottom: 12,
  },
  backText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  headerText: {
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
