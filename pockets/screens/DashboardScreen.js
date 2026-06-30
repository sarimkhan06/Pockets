// DashboardScreen.js — the main home screen, shown when the user opens the app.
//
// Shows:
//   - Total balance (sum of all pocket balances)
//   - A 2-column grid of all pockets
//   - The 4 most recent transactions
//
// Key concept — useFocusEffect:
//   useEffect runs once when the component mounts.
//   useFocusEffect runs every time this screen comes into view (gains focus).
//   We use useFocusEffect here so that if the user assigns a transaction in the Inbox
//   tab and then comes back to Dashboard, the balances automatically update.

import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { API_URL } from '../lib/config';
import { formatDate, sortTxNewestFirst, formatCurrency } from '../lib/utils';
import { supabase } from '../lib/supabase';

// Dimensions.get('window') returns the screen width and height in pixels.
// We use this to calculate the width of each pocket card so that exactly
// 2 cards fit side-by-side with equal spacing.
const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 48 = 20 left padding + 20 right padding + 8 gap

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning 👋';
  if (hour < 17) return 'Good afternoon 👋';
  return 'Good evening 👋';
}

// navigation is automatically passed by React Navigation to any screen component.
// It lets you call navigation.navigate('ScreenName') or navigation.goBack().
export default function DashboardScreen({ navigation }) {
  const [pockets, setPockets] = useState([]);           // Array of pocket objects from the server
  const [transactions, setTransactions] = useState([]); // Array of all transaction objects
  const [loading, setLoading] = useState(true);          // Shows spinner while data is fetching
  const [userName, setUserName] = useState('');

  // useFocusEffect requires wrapping the callback in useCallback.
  // useCallback ensures the function reference stays stable across renders,
  // which prevents infinite loops inside useFocusEffect.
  useFocusEffect(
    useCallback(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Get the current user's session to extract their userId
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        setUserName(session?.user?.user_metadata?.full_name || '');

        // Fetch pockets and transactions at the same time (parallel requests = faster)
        const [pocketsRes, transactionsRes] = await Promise.all([
          fetch(`${API_URL}/pockets?userId=${userId}`),
          fetch(`${API_URL}/transactions?userId=${userId}`),
        ]);

        // .json() reads the response body as text and parses it into a JS object/array
        const pocketsData = await pocketsRes.json();
        const transactionsData = await transactionsRes.json();

        setPockets(pocketsData);
        setTransactions(transactionsData);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        // setLoading(false) runs whether the fetch succeeded or failed
        setLoading(false);
      }
    };

    loadData();
  }, []) // Empty array: recreate the callback only once (on mount)
  );

  // Show a centered spinner while data is loading
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    );
  }

  const unsortedPocket = pockets.find(p => p.is_unsorted);
  const namedPockets = pockets.filter(p => !p.is_unsorted);

  // Total = sum of all pockets including Unsorted, which always equals the live bank balance
  const totalBalance = pockets.reduce((sum, p) => sum + p.balance, 0);

  const recentTransactions = sortTxNewestFirst(transactions).slice(0, 4);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.appName}>Pockets</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userName ? userName[0].toUpperCase() : '?'}</Text>
          </View>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>${formatCurrency(totalBalance)}</Text>
          <Text style={styles.balanceNote}>
            across {namedPockets.length} pocket{namedPockets.length !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Pockets</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AddPocket')}>
            <Text style={styles.sectionAction}>+ New</Text>
          </TouchableOpacity>
        </View>

        {namedPockets.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyPockets}
            onPress={() => navigation.navigate('AddPocket')}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyPocketsPlus}>+</Text>
            <Text style={styles.emptyPocketsTitle}>Create your first pocket</Text>
            <Text style={styles.emptyPocketsSub}>Tap to add a spending envelope</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.grid}>
            {namedPockets.map(pocket => (
              <TouchableOpacity
                key={pocket.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('PocketDetail', { pocket })}
              >
                <View style={[styles.cardTopBar, { backgroundColor: pocket.color }]} />
                <Text style={styles.cardName}>{pocket.name}</Text>
                <Text style={[styles.cardBalance, pocket.balance <= 0 && styles.cardDepleted]}>
                  ${formatCurrency(pocket.balance)}
                </Text>
                <Text style={styles.cardBalanceLabel}>available</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Unsorted pocket — only shown when non-zero. Signals unassigned transactions. */}
        {unsortedPocket && unsortedPocket.balance !== 0 && (
          <View style={styles.unsortedCard}>
            <View style={styles.unsortedLeft}>
              <Text style={styles.unsortedLabel}>Unsorted</Text>
              <Text style={styles.unsortedSub}>
                {unsortedPocket.balance < 0
                  ? 'A transaction is on its way through Plaid — assign it once it appears in your inbox'
                  : 'Income or a deposit is making its way through Plaid'}
              </Text>
            </View>
            <Text style={[styles.unsortedAmount, { color: unsortedPocket.balance < 0 ? '#FF5252' : '#00D4AA' }]}>
              {unsortedPocket.balance < 0 ? '-' : '+'}${formatCurrency(Math.abs(unsortedPocket.balance))}
            </Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
            <Text style={styles.sectionAction}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.txCard}>
          {recentTransactions.map((tx, index) => (
            <View
              key={tx.id}
              style={[styles.txRow, index < recentTransactions.length - 1 && styles.txBorder]}
            >
              <View style={styles.txIcon}>
                <Text style={styles.txEmoji}>{tx.icon}</Text>
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txMerchant}>{tx.merchant}</Text>
                <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
              </View>
              <Text style={[styles.txAmount, { color: tx.amount < 0 ? '#FF5252' : '#00D4AA' }]}>
                {tx.amount < 0 ? '-' : '+'}${formatCurrency(Math.abs(tx.amount))}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerSpacer: { width: 40 }, // Matches the avatar width so the title stays centered
  headerCenter: { flex: 1, alignItems: 'center' },
  greeting: { fontSize: 13, color: '#8899AA', marginBottom: 2 },
  appName: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#00D4AA', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#0B1120' },

  balanceCard: {
    marginHorizontal: 20,
    backgroundColor: '#151F32',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 8,
    alignItems: 'center',
  },
  balanceLabel: { fontSize: 13, color: '#8899AA', marginBottom: 6, textAlign: 'center' },
  balanceAmount: {
    fontSize: 42, fontWeight: '800', color: '#FFFFFF',
    letterSpacing: -1, marginBottom: 8, textAlign: 'center',
  },
  balanceNote: { fontSize: 13, color: '#4A5E78', textAlign: 'center' },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginTop: 24, marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  sectionAction: { fontSize: 13, color: '#00D4AA', fontWeight: '600' },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', // Wrap to new line after 2 cards
    paddingHorizontal: 20, justifyContent: 'space-between',
  },
  card: {
    width: CARD_WIDTH, backgroundColor: '#151F32', borderRadius: 16,
    overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)', marginBottom: 12,
  },
  cardTopBar: { height: 4, width: '100%', marginBottom: 14 },
  cardName: { fontSize: 13, color: '#8899AA', paddingHorizontal: 14, marginBottom: 4 },
  cardBalance: {
    fontSize: 24, fontWeight: '800', color: '#FFFFFF',
    paddingHorizontal: 14, letterSpacing: -0.5,
  },
  cardDepleted: { color: '#FF5252' }, // Red balance for empty pockets
  cardBalanceLabel: { fontSize: 11, color: '#4A5E78', paddingHorizontal: 14, paddingBottom: 14 },

  unsortedCard: {
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: '#151F32', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,159,67,0.25)',
    flexDirection: 'row', alignItems: 'center',
    padding: 16,
  },
  unsortedLeft: { flex: 1 },
  unsortedLabel: { fontSize: 14, fontWeight: '700', color: '#FF9F43', marginBottom: 2 },
  unsortedSub: { fontSize: 12, color: '#8899AA' },
  unsortedAmount: { fontSize: 18, fontWeight: '800' },

  emptyPockets: {
    marginHorizontal: 20, backgroundColor: '#151F32', borderRadius: 16,
    borderWidth: 1.5, borderColor: '#00D4AA', borderStyle: 'dashed',
    paddingVertical: 36, alignItems: 'center', marginBottom: 12,
  },
  emptyPocketsPlus: { fontSize: 32, color: '#00D4AA', fontWeight: '300', marginBottom: 10 },
  emptyPocketsTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  emptyPocketsSub: { fontSize: 13, color: '#4A5E78' },

  txCard: {
    marginHorizontal: 20, backgroundColor: '#151F32', borderRadius: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  txIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1C2B45', alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  txEmoji: { fontSize: 18 },
  txDetails: { flex: 1 }, // flex: 1 makes this column take up all remaining horizontal space
  txMerchant: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  txDate: { fontSize: 12, color: '#8899AA', marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },
});
