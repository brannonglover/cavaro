import { View, StyleSheet, Text, SafeAreaView, Image, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AddCigarBtn from '../components/AddCigarBtn';
import AccountMenu from '../components/AccountMenu';
import CigarList from '../components/CigarList';
import FeedbackBtn from '../components/FeedbackBtn';
import { useAuth } from '../context/AuthContext';
import { getArchiveCount } from '../db';
import colors from '../theme/colors';

function Cavaro({ navigation }) {
  const view = 'cavaro';
  const { user, supabase } = useAuth();
  const [archiveCount, setArchiveCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getArchiveCount()
        .then((count) => {
          if (!cancelled) setArchiveCount(count);
        })
        .catch(() => {});
      return () => { cancelled = true; };
    }, [])
  );

  return (
    <>
      <View style={styles.screen}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image
                source={require('../assets/logo-wo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.subtitle}>Your collection</Text>
            </View>
            <View style={styles.headerRight}>
              <FeedbackBtn />
              {user && (
                <AccountMenu onSignOut={() => supabase?.auth.signOut()}>
                  <MaterialCommunityIcons
                    name="dots-vertical"
                    size={24}
                    color={colors.textSecondary}
                  />
                </AccountMenu>
              )}
            </View>
          </View>
          {archiveCount > 0 && (
            <Pressable
              style={styles.archiveBanner}
              onPress={() => navigation.navigate('Archive')}
            >
              <MaterialCommunityIcons name="archive-outline" size={20} color={colors.primary} />
              <Text style={styles.archiveBannerText}>
                {archiveCount} smoked {archiveCount === 1 ? 'cigar needs' : 'cigars need'} your thoughts
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
            </Pressable>
          )}
          <CigarList view={view} onEditCigar={(cigar) => navigation.navigate('EditCigar', { cigar })} />
        </SafeAreaView>
      </View>
      <AddCigarBtn onPress={() => navigation.navigate('AddCigar')} />
    </>
  );
}

export default Cavaro;

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
    justifyContent: 'flex-start',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerLeft: {
    alignItems: 'flex-start',
  },
  logo: {
    height: 40,
    width: 74,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginLeft: 'auto',
  },
  archiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  archiveBannerText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});
