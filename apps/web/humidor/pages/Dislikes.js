import { SafeAreaView, StyleSheet, View, Text } from 'react-native';
import CigarList from '../components/CigarList';
import colors from '../theme/colors';

function Dislikes() {
  const view = 'dislikes';

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Dislikes</Text>
          <Text style={styles.subtitle}>Cigars to avoid</Text>
        </View>
        <CigarList view={view} />
      </SafeAreaView>
    </View>
  );
}

export default Dislikes;

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