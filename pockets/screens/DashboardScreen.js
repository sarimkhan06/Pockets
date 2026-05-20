import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import ChatPanel from '../components/ChatPanel';

// Your computer's local IP — the app uses this to reach your backend server
const API_URL = 'http://192.168.2.140:3000';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function DashboardScreen({ navigation }) {
  const [chatOpen, setChatOpen] = useState(false);

  // Store pockets and transactions from the server in state
  const [pockets, setPockets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // useEffect with [] runs once when the screen first loads
  // This is where we fetch data from the backend
  useEffect(() => {
    const loadData = async () => {
      try {
        // fetch() makes an HTTP request — here we're calling GET /pockets and GET /transactions
        const [pocketsRes, transactionsRes] = await Promise.all([
          fetch(`${API_URL}/pockets`),
          fetch(`${API_URL}/transactions`),
        ]);

        // .json() reads the response body and parses it from JSON into a JS array
        const pocketsData = await pocketsRes.json();
        const transactionsData = await transactionsRes.json();

        setPockets(pocketsData);
        setTransactions(transactionsData);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Show a spinner while data is loading
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    );
  }

  const totalBudget = pockets.reduce((sum, p) => sum + p.budget, 0);
  const totalSpent = pockets.reduce((sum, p) => sum + p.spent, 0);
  const totalAvailable = totalBudget - totalSpent;
  const recentTransactions = transactions.slice(0, 4);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>Good morning 👋</Text>
            <Text style={styles.appName}>Pockets</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>S</Text>
          </View>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Available</Text>
          <Text style={styles.balanceAmount}>${totalAvailable.toLocaleString()}.00</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatLabel}>Monthly Income</Text>
              <Text style={styles.balanceStatIncome}>+$5,000</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatLabel}>Spent So Far</Text>
              <Text style={styles.balanceStatSpent}>-${totalSpent.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Pockets */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Pockets</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AddPocket')}>
            <Text style={styles.sectionAction}>+ New</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          {pockets.map(pocket => {
            const pct = pocket.spent / pocket.budget;
            const left = pocket.budget - pocket.spent;
            return (
              <TouchableOpacity
                key={pocket.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('PocketDetail', { pocket })}
              >
                <View style={[styles.cardTopBar, { backgroundColor: pocket.color }]} />
                <Text style={styles.cardName}>{pocket.name}</Text>
                <Text style={[styles.cardLeft, left <= 0 && styles.cardDepleted]}>
                  ${left}
                </Text>
                <Text style={styles.cardLeftLabel}>remaining</Text>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(pct * 100, 100)}%`, backgroundColor: pocket.color },
                    ]}
                  />
                </View>
                <Text style={styles.cardSub}>${pocket.spent} / ${pocket.budget}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Recent Transactions */}
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
                <Text style={styles.txDate}>{tx.date}</Text>
              </View>
              <Text style={[styles.txAmount, { color: tx.amount < 0 ? '#FF5252' : '#00D4AA' }]}>
                {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Floating AI button */}
      <TouchableOpacity style={styles.fab} onPress={() => setChatOpen(true)} activeOpacity={0.85}>
        <Text style={styles.fabEmoji}>✦</Text>
        <Text style={styles.fabLabel}>AI</Text>
      </TouchableOpacity>

      <ChatPanel visible={chatOpen} onClose={() => setChatOpen(false)} />
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
  headerSpacer: { width: 40 },
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
    letterSpacing: -1, marginBottom: 20, textAlign: 'center',
  },
  balanceRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  balanceStat: { flex: 1, alignItems: 'center' },
  balanceStatLabel: { fontSize: 11, color: '#8899AA', marginBottom: 3, textAlign: 'center' },
  balanceStatIncome: { fontSize: 15, fontWeight: '700', color: '#00D4AA', textAlign: 'center' },
  balanceStatSpent: { fontSize: 15, fontWeight: '700', color: '#FF5252', textAlign: 'center' },
  balanceDivider: {
    width: 1, height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 16,
  },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginTop: 24, marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  sectionAction: { fontSize: 13, color: '#00D4AA', fontWeight: '600' },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 20, justifyContent: 'space-between',
  },
  card: {
    width: CARD_WIDTH, backgroundColor: '#151F32', borderRadius: 16,
    overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)', marginBottom: 12,
  },
  cardTopBar: { height: 4, width: '100%', marginBottom: 14 },
  cardName: { fontSize: 13, color: '#8899AA', paddingHorizontal: 14, marginBottom: 4 },
  cardLeft: {
    fontSize: 24, fontWeight: '800', color: '#FFFFFF',
    paddingHorizontal: 14, letterSpacing: -0.5,
  },
  cardDepleted: { color: '#FF5252' },
  cardLeftLabel: { fontSize: 11, color: '#4A5E78', paddingHorizontal: 14, marginBottom: 12 },
  progressBg: {
    height: 3, backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 14, borderRadius: 2, overflow: 'hidden', marginBottom: 8,
  },
  progressFill: { height: 3, borderRadius: 2 },
  cardSub: { fontSize: 10, color: '#4A5E78', paddingHorizontal: 14, paddingBottom: 14 },

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
  txDetails: { flex: 1 },
  txMerchant: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  txDate: { fontSize: 12, color: '#8899AA', marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },

  fab: {
    position: 'absolute', bottom: 28, right: 24,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#00D4AA', paddingHorizontal: 18, paddingVertical: 14,
    borderRadius: 30, shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  fabEmoji: { fontSize: 14, color: '#0B1120', fontWeight: '800', marginRight: 6 },
  fabLabel: { fontSize: 14, fontWeight: '800', color: '#0B1120' },
});
