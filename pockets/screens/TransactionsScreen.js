// TransactionsScreen.js — shows every transaction for the user, newest first.
//
// Each transaction row shows:
//   - Emoji icon
//   - Merchant name + date
//   - A color-coded "pocket tag" showing which pocket it was assigned to
//   - Amount (red for expenses, green for income)
//
// Transactions without a pocket_id show "Inbox" as their pocket label,
// meaning they haven't been assigned yet (they live in InboxScreen).
//
// The "⚡ Sync" button manually triggers a Plaid transaction pull.
// On app open, App.js does this automatically — but this button lets the user
// force a refresh if they just made a purchase and want to see it now.

import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { API_URL } from '../lib/config';
import { formatDate, sortTxNewestFirst, formatCurrency } from '../lib/utils';
import { supabase } from '../lib/supabase';

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState([]); // All transactions for this user
  const [pockets, setPockets] = useState([]);           // All pockets — used to look up pocket name/color
  const [loading, setLoading] = useState(true);          // Initial full-screen spinner
  const [syncing, setSyncing] = useState(false);         // Spinner on just the Sync button

  // Refresh data every time the user navigates to this tab
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        setLoading(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const userId = session?.user?.id;

          // Fetch both at the same time
          const [txRes, pocketsRes] = await Promise.all([
            fetch(`${API_URL}/transactions?userId=${userId}`),
            fetch(`${API_URL}/pockets?userId=${userId}`),
          ]);
          setTransactions(await txRes.json());
          setPockets(await pocketsRes.json());
        } catch (e) {
          console.error('Failed to load transactions:', e);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }, [])
  );

  // Calls the backend, which tells Plaid to fetch new transactions, then reloads the list
  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      // POST to /plaid/sync-transactions — the backend asks Plaid for new transactions
      // and saves any new ones to Supabase, then returns how many were added
      const res = await fetch(`${API_URL}/plaid/sync-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Show how many new transactions arrived
      Alert.alert('Synced', `${data.count} new transaction${data.count !== 1 ? 's' : ''} added.`);

      // Reload the list to include the new transactions
      const [txRes, pocketsRes] = await Promise.all([
        fetch(`${API_URL}/transactions?userId=${userId}`),
        fetch(`${API_URL}/pockets?userId=${userId}`),
      ]);
      setTransactions(await txRes.json());
      setPockets(await pocketsRes.json());
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to sync transactions');
    } finally {
      setSyncing(false);
    }
  };

  // Helper: given a pocketId, find and return the full pocket object from our local state.
  // We use this to display the pocket's name and color next to each transaction.
  const getPocket = (pocketId) => pockets.find(p => p.id === pocketId);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    );
  }

  const sorted = sortTxNewestFirst(transactions);

  return (
    <View style={styles.container}>
      {/* Header with title and sync button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Transactions</Text>
        <TouchableOpacity onPress={handleSync} disabled={syncing} style={styles.syncBtn} activeOpacity={0.7}>
          {syncing
            ? <ActivityIndicator size="small" color="#00D4AA" />
            : <Text style={styles.syncBtnText}>⚡ Sync</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {sorted.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No transactions yet.</Text>
          </View>
        ) : (
          <View style={styles.txCard}>
            {sorted.map((tx, index) => {
              // Look up this transaction's pocket info
              const pocket = getPocket(tx.pocket_id);
              const pocketColor = pocket?.color ?? '#4A5E78'; // Default grey if no pocket
              // tx.pocket_id exists but pocket not found = 'Unknown', no id = 'Inbox' (unassigned)
              const pocketName = pocket?.name ?? (tx.pocket_id ? 'Unknown' : 'Inbox');
              return (
                <View
                  key={tx.id}
                  style={[styles.txRow, index < sorted.length - 1 && styles.txBorder]}
                >
                  <View style={styles.txIcon}>
                    <Text style={styles.txEmoji}>{tx.icon}</Text>
                  </View>
                  <View style={styles.txDetails}>
                    <Text style={styles.txMerchant}>{tx.merchant}</Text>
                    <View style={styles.txMeta}>
                      <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
                      <Text style={styles.txDot}> · </Text>
                      {/* Pocket tag: background is the pocket color at 13% opacity ('22' in hex) */}
                      <View style={[styles.pocketTag, { backgroundColor: pocketColor + '22' }]}>
                        <Text style={[styles.pocketTagText, { color: pocketColor }]}>
                          {pocketName}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.txAmount, { color: tx.amount < 0 ? '#FF5252' : '#00D4AA' }]}>
                    {tx.amount < 0 ? '-' : '+'}${formatCurrency(Math.abs(tx.amount))}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  syncBtn: {
    backgroundColor: '#151F32', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  syncBtnText: { fontSize: 13, fontWeight: '600', color: '#00D4AA' },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 15, color: '#8899AA' },

  txCard: {
    marginHorizontal: 20, backgroundColor: '#151F32', borderRadius: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  txIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#1C2B45', alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  txEmoji: { fontSize: 18 },
  txDetails: { flex: 1 },
  txMerchant: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 4 },
  txMeta: { flexDirection: 'row', alignItems: 'center' },
  txDate: { fontSize: 12, color: '#8899AA' },
  txDot: { fontSize: 12, color: '#4A5E78' },
  pocketTag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  pocketTagText: { fontSize: 11, fontWeight: '600' },
  txAmount: { fontSize: 14, fontWeight: '700' },
});
