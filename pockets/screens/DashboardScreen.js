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
  }, [])) // Empty array: recreate the callback only once (on mount)
  );

  // Show a centered spinner while data is loading
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    );
  }

  // .reduce() iterates over the pockets array and accumulates a running total.
  // sum starts at 0, and each iteration adds p.balance to it.
  const totalBalance = pockets.reduce((sum, p) => sum + p.balance, 0);

  // Sort all transactions newest-first, then take only the first 4
  const recentTransactions = sortTxNewestFirst(transactions).slice(0, 4);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header row: avatar on the right, app name in the center */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} /> {/* Invisible spacer to balance the avatar */}
          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>Good morning 👋</Text>
            <Text style={styles.appName}>Pockets</Text>
          </View>
          {/* Avatar circle showing the first letter of the user's name */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userName ? userName[0].toUpperCase() : '?'}</Text>
          </View>
        </View>

        {/* Total balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>${formatCurrency(totalBalance)}</Text>
          <Text style={styles.balanceNote}>
            {/* Pluralize "pocket" correctly: "1 pocket" vs "3 pockets" */}
            across {pockets.length} pocket{pockets.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Section header: "My Pockets" title + "+ New" button */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Pockets</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AddPocket')}>
            <Text style={styles.sectionAction}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* If no pockets exist, show a dashed "create your first pocket" card instead of the grid */}
        {pockets.length === 0 ? (
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
          // 2-column grid of pocket cards
          <View style={styles.grid}>
            {pockets.map(pocket => (
              // Tapping a pocket card navigates to PocketDetail, passing the pocket object as a param.
              // The receiving screen accesses it via route.params.pocket
              <TouchableOpacity
                key={pocket.id} // React needs a unique key for each item in a list
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('PocketDetail', { pocket })}
              >
                {/* The colored bar at the top matches the pocket's chosen color */}
                <View style={[styles.cardTopBar, { backgroundColor: pocket.color }]} />
                <Text style={styles.cardName}>{pocket.name}</Text>
                {/* Balance turns red if the pocket is at $0 or negative */}
                <Text style={[styles.cardBalance, pocket.balance <= 0 && styles.cardDepleted]}>
                  ${formatCurrency(pocket.balance)}
                </Text>
                <Text style={styles.cardBalanceLabel}>available</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Transactions section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {/* "See all" navigates to the Transactions tab */}
          <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
            <Text style={styles.sectionAction}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.txCard}>
          {recentTransactions.map((tx, index) => (
            <View
              key={tx.id}
              // Add a bottom border to all rows except the last one
              style={[styles.txRow, index < recentTransactions.length - 1 && styles.txBorder]}
            >
              {/* Circular emoji icon */}
              <View style={styles.txIcon}>
                <Text style={styles.txEmoji}>{tx.icon}</Text>
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txMerchant}>{tx.merchant}</Text>
                <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
              </View>
              {/* Amount is red for expenses (negative) and green for income (positive) */}
              <Text style={[styles.txAmount, { color: tx.amount < 0 ? '#FF5252' : '#00D4AA' }]}>
                {tx.amount < 0 ? '-' : '+'}${formatCurrency(Math.abs(tx.amount))}
              </Text>
            </View>
          ))}
        </View>

        {/* Spacer at the bottom so the last card isn't cut off by the tab bar */}
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
