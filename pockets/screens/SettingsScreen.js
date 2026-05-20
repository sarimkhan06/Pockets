import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';

export default function SettingsScreen({ onLogout, onRetakeQuiz, profile, currentMethod, navigation }) {
  const handleLogout = async () => {
    await supabase.auth.signOut(); // signs out from Supabase, clears the session
    onLogout(); // tells App.js to switch to the login screen
  };
  const Row = ({ icon, label, value, onPress, danger }) => (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={[styles.rowLabel, danger && styles.dangerText]}>{label}</Text>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      {!danger && <Text style={styles.rowChevron}>›</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Profile */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {profile?.name ? profile.name[0].toUpperCase() : 'S'}
            </Text>
          </View>
          <View>
            <Text style={styles.profileName}>{profile?.name ?? 'Your Name'}</Text>
            <Text style={styles.profileMeta}>
              {profile?.stage?.label ?? ''}{profile?.age ? `  ·  ${profile.age}` : ''}
            </Text>
          </View>
        </View>

        {/* Budgeting Method */}
        <Text style={styles.sectionLabel}>Budget</Text>
        <View style={styles.section}>
          {currentMethod && (
            <View style={styles.methodBanner}>
              <Text style={styles.methodIcon}>{currentMethod.icon}</Text>
              <View style={styles.methodText}>
                <Text style={styles.methodName}>{currentMethod.name}</Text>
                <Text style={styles.methodTagline}>{currentMethod.tagline}</Text>
              </View>
            </View>
          )}
          <Row icon="🔄" label="Switch Method" onPress={() => navigation.navigate('SwitchMethod', { currentMethodId: currentMethod?.id })} />
          <Row icon="📋" label="Retake Quiz" onPress={onRetakeQuiz} />
        </View>

        {/* Bank */}
        <Text style={styles.sectionLabel}>Bank</Text>
        <View style={styles.section}>
          <Row icon="🏦" label="Connected Account" value="Not connected" onPress={() => navigation.navigate('ConnectBank')} />
          <Row icon="⚡" label="Sync Transactions" onPress={() => {}} />
        </View>

        {/* Preferences */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.section}>
          <Row icon="🔔" label="Notifications" value="On" onPress={() => {}} />
          <Row icon="🤖" label="AI Auto-Assign" value="On" onPress={() => {}} />
          <Row icon="💰" label="Currency" value="CAD" onPress={() => {}} />
        </View>

        {/* Account */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.section}>
          <Row icon="🔒" label="Change Password" onPress={() => {}} />
          <Row icon="🚪" label="Sign Out" onPress={handleLogout} danger />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, backgroundColor: '#151F32',
    borderRadius: 16, padding: 16, gap: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 24,
  },
  profileAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#00D4AA', alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarText: { fontSize: 22, fontWeight: '800', color: '#0B1120' },
  profileName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 3 },
  profileMeta: { fontSize: 13, color: '#8899AA' },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#8899AA',
    textTransform: 'uppercase', letterSpacing: 1,
    paddingHorizontal: 20, marginBottom: 8,
  },
  section: {
    marginHorizontal: 20, backgroundColor: '#151F32', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 24, overflow: 'hidden',
  },
  methodBanner: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', gap: 12,
  },
  methodIcon: { fontSize: 28 },
  methodText: { flex: 1 },
  methodName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  methodTagline: { fontSize: 12, color: '#8899AA' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowIcon: { fontSize: 18, marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  rowValue: { fontSize: 13, color: '#8899AA', marginRight: 6 },
  rowChevron: { fontSize: 18, color: '#4A5E78' },
  dangerText: { color: '#FF5252' },
});
