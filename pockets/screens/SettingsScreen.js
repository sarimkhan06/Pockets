import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { API_URL } from '../lib/config';
import { TEMPLATES } from '../data/onboardingData';

export default function SettingsScreen({ onLogout, onRetakeQuiz, userName, currentMethod, onRestoreComplete, navigation }) {
  const [backup, setBackup] = useState(null);
  const [bankConnected, setBankConnected] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [displayMethod, setDisplayMethod] = useState(currentMethod);
  const [localUserName, setLocalUserName] = useState(userName);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      // Fetch name directly from session — don't rely on the prop chain
      setLocalUserName(session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || '');

      const [backupRes, bankRes, settingsRes] = await Promise.all([
        fetch(`${API_URL}/pockets/backup?userId=${userId}`),
        fetch(`${API_URL}/plaid/status?userId=${userId}`),
        fetch(`${API_URL}/user-settings?userId=${userId}`),
      ]);
      setBackup(await backupRes.json());
      setBankConnected((await bankRes.json()).connected);
      const settings = await settingsRes.json();
      if (settings?.method_id && TEMPLATES[settings.method_id]) {
        setDisplayMethod(TEMPLATES[settings.method_id]);
      }
    } catch (e) {
      setBackup({ hasBackup: false });
      setBankConnected(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/plaid/sync-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session?.user?.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      Alert.alert('Synced', `${data.count} new transaction${data.count !== 1 ? 's' : ''} added to your inbox.`);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to sync transactions');
    } finally {
      setSyncing(false);
    }
  };

  const handleRestore = () => {
    Alert.alert(
      'Restore previous setup',
      `This will replace your current pockets with your previous setup (${backup.pocketCount} pocket${backup.pocketCount !== 1 ? 's' : ''}). Balances will be re-distributed from your bank.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', style: 'destructive', onPress: doRestore },
      ]
    );
  };

  const doRestore = async () => {
    setRestoring(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      const targetMethodId = backup?.previousMethodId;

      const res = await fetch(`${API_URL}/pockets/backup/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, targetMethodId }),
      });
      const data = await res.json();
      if (data.error) { Alert.alert('Error', data.error); return; }

      // Update the method display immediately from what we already know
      const restoredMethodId = targetMethodId || data.restoredMethodId;
      if (restoredMethodId && TEMPLATES[restoredMethodId]) {
        setDisplayMethod(TEMPLATES[restoredMethodId]);
        onRestoreComplete?.(restoredMethodId);
      }

      // Reload backup status
      const backupRes = await fetch(`${API_URL}/pockets/backup?userId=${userId}`);
      setBackup(await backupRes.json());

      Alert.alert('Restored', 'Your previous setup is back. Go to Dashboard to see it.');
    } catch (e) {
      Alert.alert('Error', 'Could not reach the server.');
    } finally {
      setRestoring(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  const Row = ({ icon, label, value, onPress, danger, loading }) => (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7} disabled={loading}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={[styles.rowLabel, danger && styles.dangerText]}>{label}</Text>
      {loading
        ? <ActivityIndicator size="small" color="#8899AA" />
        : value !== undefined
          ? <Text style={styles.rowValue}>{value}</Text>
          : null
      }
      {!danger && !loading && <Text style={styles.rowChevron}>›</Text>}
    </TouchableOpacity>
  );

  const bankStatusLabel = bankConnected === null ? '…' : bankConnected ? 'Connected' : 'Not connected';

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
              {localUserName ? localUserName[0].toUpperCase() : '?'}
            </Text>
          </View>
          <View>
            <Text style={styles.profileName}>{localUserName || 'Your Account'}</Text>
          </View>
        </View>

        {/* Budget */}
        <Text style={styles.sectionLabel}>Budget</Text>
        <View style={styles.section}>
          {displayMethod && (
            <View style={styles.methodBanner}>
              <Text style={styles.methodIcon}>{displayMethod.icon}</Text>
              <View style={styles.methodText}>
                <Text style={styles.methodName}>{displayMethod.name}</Text>
                <Text style={styles.methodTagline}>{displayMethod.tagline}</Text>
              </View>
            </View>
          )}
          <Row icon="🔄" label="Change Template" onPress={() => {
            Alert.alert(
              'Change Template',
              'This will replace your current pockets with a new template.\n\nTransaction history assigned to your current pockets will no longer be accessible. Your pocket structure can be restored from Settings, but transactions will not be recovered.\n\nContinue?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Continue', style: 'destructive', onPress: onRetakeQuiz },
              ]
            );
          }} />
          {backup?.hasBackup && (
            <TouchableOpacity
              style={styles.restoreRow}
              onPress={handleRestore}
              disabled={restoring}
              activeOpacity={0.7}
            >
              <Text style={styles.restoreIcon}>↩</Text>
              <Text style={styles.restoreLabel}>
                Restore previous setup ({backup.pocketCount} pocket{backup.pocketCount !== 1 ? 's' : ''})
              </Text>
              {restoring
                ? <ActivityIndicator size="small" color="#FF9F43" />
                : <Text style={styles.restoreChevron}>›</Text>
              }
            </TouchableOpacity>
          )}
        </View>

        {/* Bank */}
        <Text style={styles.sectionLabel}>Bank</Text>
        <View style={styles.section}>
          <Row
            icon="🏦"
            label="Connected Account"
            value={bankStatusLabel}
            onPress={() => navigation.navigate('ConnectBank')}
          />
          <Row
            icon="⚡"
            label="Sync Transactions"
            onPress={handleSync}
            loading={syncing}
          />
        </View>

        {/* Account */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.section}>
          <Row icon="🔐" label="Two-Factor Auth" value="Enabled" />
          <Row icon="🔑" label="Change Password" onPress={() => navigation.navigate('ChangePassword')} />
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
  profileName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

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

  restoreRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(255,159,67,0.06)',
  },
  restoreIcon: { fontSize: 16, marginRight: 12, color: '#FF9F43' },
  restoreLabel: { flex: 1, fontSize: 14, color: '#FF9F43', fontWeight: '500' },
  restoreChevron: { fontSize: 18, color: '#FF9F43' },
});
