import { SafeAreaView, StyleSheet, View, Text } from 'react-native';
import CigarList from '../components/CigarList';
import FeedbackBtn from '../components/FeedbackBtn';
import colors from '../theme/colors';

function Favorites({ navigation }) {
  const view = 'likes';

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Favorites</Text>
            <Text style={styles.subtitle}>Cigars you love</Text>
          </View>
          <FeedbackBtn />
        </View>
        <CigarList
          view={view}
          onEditCigar={(cigar) => navigation.navigate('Humidor', { screen: 'EditCigar', params: { cigar } })}
        />
      </SafeAreaView>
    </View>
  );
}

export default Favorites;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
