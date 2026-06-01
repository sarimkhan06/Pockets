import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { API_URL } from '../lib/config';
import { formatDate, formatCurrency } from '../lib/utils';

export default function PocketDetailScreen({ route, navigation }) {
  const { pocket } = route.params;
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const loadTransactions = async () => {
        setLoading(true);
        try {
          const res = await fetch(`${API_URL}/transactions/pocket/${pocket.id}`);
          const data = await res.json();
          setTransactions([...data].reverse());
        } catch (error) {
          console.error('Failed to load transactions:', error);
        } finally {
          setLoading(false);
        }
      };

      loadTransactions();
    }, [pocket.id])
  );

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pocket.name}</Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate('EditPocket', { pocket })}
        >
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Pocket summary card */}
        <View style={[styles.summaryCard, { borderTopColor: pocket.color }]}>
          <Text style={styles.summaryLabel}>Available</Text>
          <Text style={[styles.summaryAmount, pocket.balance <= 0 && styles.summaryDepleted]}>
            ${formatCurrency(pocket.balance)}
          </Text>
        </View>

        {/* Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          {!loading && (
            <View style={[styles.badge, { backgroundColor: pocket.color + '22' }]}>
              <Text style={[styles.badgeText, { color: pocket.color }]}>
                {transactions.length}
              </Text>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color="#00D4AA" style={{ marginTop: 40 }} />
        ) : transactions.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          <View style={styles.txCard}>
            {transactions.map((tx, index) => (
              <View
                key={tx.id}
                style={[styles.txRow, index < transactions.length - 1 && styles.txBorder]}
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
  editBtn: {
    backgroundColor: '#151F32', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: '#00D4AA' },

  summaryCard: {
    marginHorizontal: 20, backgroundColor: '#151F32', borderRadius: 20,
    padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderTopWidth: 4, marginBottom: 8,
  },
  summaryLabel: { fontSize: 13, color: '#8899AA', marginBottom: 6 },
  summaryAmount: { fontSize: 42, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1, marginBottom: 16 },
  summaryDepleted: { color: '#FF5252' },
  progressBg: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3, overflow: 'hidden', marginBottom: 14,
  },
  progressFill: { height: 6, borderRadius: 3 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryMeta: { fontSize: 13, color: '#8899AA' },
  summarySpent: { color: '#FF5252', fontWeight: '600' },
  summaryWhite: { color: '#FFFFFF', fontWeight: '600' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, marginTop: 24, marginBottom: 12, gap: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: '#4A5E78' },

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
