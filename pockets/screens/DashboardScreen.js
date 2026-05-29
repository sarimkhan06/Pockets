import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { API_URL } from '../lib/config';
import { formatDate, sortTxNewestFirst } from '../lib/utils';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function DashboardScreen({ navigation }) {
  // Store pockets and transactions from the server in state
  const [pockets, setPockets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  // useFocusEffect runs every time this screen comes into focus
  // So when you come back from Inbox, it re-fetches the latest data
  useFocusEffect(
    useCallback(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        setUserName(session?.user?.user_metadata?.full_name || '');

        const [pocketsRes, transactionsRes] = await Promise.all([
          fetch(`${API_URL}/pockets?userId=${userId}`),
          fetch(`${API_URL}/transactions?userId=${userId}`),
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
  }, []));

  // Show a spinner while data is loading
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    );
  }

  const totalBalance = pockets.reduce((sum, p) => sum + p.balance, 0);
  const recentTransactions = sortTxNewestFirst(transactions).slice(0, 4);

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
            <Text style={styles.avatarText}>{userName ? userName[0].toUpperCase() : '?'}</Text>
          </View>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>${totalBalance.toFixed(2)}</Text>
          <Text style={styles.balanceNote}>
            across {pockets.length} pocket{pockets.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Pockets */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Pockets</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AddPocket')}>
            <Text style={styles.sectionAction}>+ New</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          {pockets.map(pocket => (
            <TouchableOpacity
              key={pocket.id}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('PocketDetail', { pocket })}
            >
              <View style={[styles.cardTopBar, { backgroundColor: pocket.color }]} />
              <Text style={styles.cardName}>{pocket.name}</Text>
              <Text style={[styles.cardBalance, pocket.balance <= 0 && styles.cardDepleted]}>
                ${pocket.balance.toFixed(2)}
              </Text>
              <Text style={styles.cardBalanceLabel}>available</Text>
            </TouchableOpacity>
          ))}
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
                <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
              </View>
              <Text style={[styles.txAmount, { color: tx.amount < 0 ? '#FF5252' : '#00D4AA' }]}>
                {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
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
  cardBalance: {
    fontSize: 24, fontWeight: '800', color: '#FFFFFF',
    paddingHorizontal: 14, letterSpacing: -0.5,
  },
  cardDepleted: { color: '#FF5252' },
  cardBalanceLabel: { fontSize: 11, color: '#4A5E78', paddingHorizontal: 14, paddingBottom: 14 },

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

});
