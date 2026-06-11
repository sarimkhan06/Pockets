// ConnectBankScreen.js — lets the user connect or reconnect their bank via Plaid.
//
// The Plaid connection flow has 3 steps:
//   Step 1: Our backend creates a "link token" (a one-time session token) for this user
//   Step 2: We use that token to launch the Plaid Link SDK — a native UI sheet that
//           lets the user securely log into their bank (credentials never touch our server)
//   Step 3: On success, Plaid gives us a short-lived "public token". We send it to our
//           backend, which exchanges it for a permanent "access token" stored in Supabase.
//
// Once connected, Plaid can be called any time to pull the user's latest transactions.
// This screen also has a "Sync Transactions" button for manual refreshes.

import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { create, open } from 'react-native-plaid-link-sdk'; // Plaid's React Native SDK
import { supabase } from '../lib/supabase';
import { API_URL } from '../lib/config';

export default function ConnectBankScreen({ navigation }) {
  const [connected, setConnected] = useState(false);   // Whether this user has a Plaid connection
  const [connecting, setConnecting] = useState(false); // Spinner while the Plaid flow is in progress
  const [syncing, setSyncing] = useState(false);       // Spinner while pulling transactions
  const [loading, setLoading] = useState(true);        // Initial status check

  // Check if the user already has a connected bank on mount
  useEffect(() => {
    checkStatus();
  }, []);

  const getUserId = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id;
  };

  // Calls the backend to ask: "does this user have a Plaid access token saved?"
  const checkStatus = async () => {
    try {
      const userId = await getUserId();
      const res = await fetch(`${API_URL}/plaid/status?userId=${userId}`);
      const data = await res.json();
      setConnected(data.connected);
    } catch (e) {
      console.error('Failed to check Plaid status:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const userId = await getUserId();

      // Step 1: Ask our backend for a Plaid link token.
      // The link token is generated server-side using our Plaid secret key —
      // the frontend never has access to the secret key.
      const res = await fetch(`${API_URL}/plaid/create-link-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const { link_token, error } = await res.json();
      if (error) throw new Error(error);

      // Step 2a: create() initializes the Plaid SDK with the token.
      // Step 2b: open() launches the Plaid Link UI (a native bank login sheet).
      // The user selects their bank and logs in — their credentials only go to Plaid, not us.
      create({ token: link_token });

      open({
        onSuccess: async (success) => {
          // success.publicToken is the short-lived token Plaid gives us after a successful login
          try {
            // Step 3: Exchange the public token for a permanent access token.
            // Our backend stores this access token in Supabase — never sent to the frontend.
            const exchangeRes = await fetch(`${API_URL}/plaid/exchange-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ publicToken: success.publicToken, userId }),
            });
            const exchangeData = await exchangeRes.json();
            if (exchangeData.error) throw new Error(exchangeData.error);
            setConnected(true);
            Alert.alert('Bank connected!', 'Tap "Sync Transactions" to pull in your latest transactions.');
          } catch (e) {
            Alert.alert('Error', e.message || 'Failed to save bank connection');
          } finally {
            setConnecting(false);
          }
        },
        onExit: (exit) => {
          // User closed the Plaid UI or an error occurred
          if (exit.error) {
            Alert.alert('Error', exit.error.display_message || 'Something went wrong. Please try again.');
          }
          setConnecting(false);
        },
      });
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to start bank connection');
      setConnecting(false);
    }
  };

  // Tells the backend to ask Plaid for new transactions (since the last sync)
  const handleSync = async () => {
    setSyncing(true);
    try {
      const userId = await getUserId();
      const res = await fetch(`${API_URL}/plaid/sync-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      Alert.alert('Synced!', `${data.count} transaction${data.count !== 1 ? 's' : ''} added to your inbox.`);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to sync transactions');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connect Bank</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero section — icon + status text changes based on connection state */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, connected && styles.heroIconConnected]}>
            <Text style={styles.heroEmoji}>{connected ? '✓' : '🏦'}</Text>
          </View>
          <Text style={styles.heroTitle}>
            {connected ? 'Bank connected' : 'Connect your bank'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {connected
              ? 'Your bank account is linked. Sync anytime to pull in your latest transactions.'
              : 'Pockets uses Plaid to securely connect to your bank. Your login credentials are never stored by us.'
            }
          </Text>
        </View>

        {/* Feature list — only shown before connecting */}
        {!connected && (
          <View style={styles.featuresCard}>
            {[
              { icon: '⚡', title: 'Real transactions', desc: 'Transactions appear in your inbox to assign to pockets.' },
              { icon: '🔒', title: 'Bank-level security', desc: 'Plaid is trusted by thousands of apps and millions of users.' },
              { icon: '👁', title: 'Read-only access', desc: 'We can only read your transactions — we cannot move money.' },
            ].map((f, i) => (
              <View key={i} style={[styles.featureRow, i < 2 && styles.featureBorder]}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Loading / connected / not connected state buttons */}
        {loading ? (
          <ActivityIndicator color="#00D4AA" style={{ marginTop: 40 }} />
        ) : connected ? (
          <>
            {/* Connected: show Sync button and option to connect a different bank */}
            <TouchableOpacity
              style={[styles.syncBtn, syncing && { opacity: 0.7 }]}
              onPress={handleSync}
              disabled={syncing}
              activeOpacity={0.85}
            >
              {syncing
                ? <ActivityIndicator color="#0B1120" />
                : <Text style={styles.syncBtnText}>Sync Transactions</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reconnectBtn}
              onPress={handleConnect}
              activeOpacity={0.85}
            >
              <Text style={styles.reconnectBtnText}>Connect a different bank</Text>
            </TouchableOpacity>
          </>
        ) : (
          // Not connected: show the "Connect with Plaid" button
          <TouchableOpacity
            style={[styles.connectBtn, connecting && { opacity: 0.7 }]}
            onPress={handleConnect}
            disabled={connecting}
            activeOpacity={0.85}
          >
            {connecting
              ? <ActivityIndicator color="#0B1120" />
              : <Text style={styles.connectBtnText}>Connect with Plaid</Text>
            }
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#151F32', alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 20, color: '#FFFFFF' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  headerSpacer: { width: 38 },

  hero: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 24, paddingBottom: 32 },
  heroIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#151F32', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  heroIconConnected: { backgroundColor: '#0D2820', borderColor: '#00D4AA' }, // Green tint when connected
  heroEmoji: { fontSize: 36 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: 12 },
  heroSubtitle: { fontSize: 14, color: '#8899AA', textAlign: 'center', lineHeight: 22 },

  featuresCard: {
    marginHorizontal: 20, backgroundColor: '#151F32', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 24, overflow: 'hidden',
  },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 16 },
  featureBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  featureIcon: { fontSize: 22, marginRight: 14, marginTop: 2 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 3 },
  featureDesc: { fontSize: 13, color: '#8899AA', lineHeight: 18 },

  connectBtn: {
    marginHorizontal: 20, backgroundColor: '#00D4AA',
    borderRadius: 16, paddingVertical: 16, alignItems: 'center',
  },
  connectBtnText: { fontSize: 15, fontWeight: '700', color: '#0B1120' },

  syncBtn: {
    marginHorizontal: 20, backgroundColor: '#00D4AA',
    borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12,
  },
  syncBtnText: { fontSize: 15, fontWeight: '700', color: '#0B1120' },

  reconnectBtn: {
    marginHorizontal: 20, paddingVertical: 14, alignItems: 'center',
  },
  reconnectBtnText: { fontSize: 14, color: '#4A5E78', fontWeight: '500' },
});
