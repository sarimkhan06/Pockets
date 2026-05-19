import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { transactions, pockets } from '../data/mockData';

export default function TransactionsScreen() {
  const getPocketName = (pocketId) => {
    if (!pocketId) return 'Unassigned';
    return pockets.find(p => p.id === pocketId)?.name ?? 'Unknown';
  };

  const getPocketColor = (pocketId) => {
    if (!pocketId) return '#4A5E78';
    return pockets.find(p => p.id === pocketId)?.color ?? '#4A5E78';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Transactions</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.txCard}>
          {transactions.map((tx, index) => {
            const pocketName = getPocketName(tx.pocketId);
            const pocketColor = getPocketColor(tx.pocketId);
            return (
              <View
                key={tx.id}
                style={[styles.txRow, index < transactions.length - 1 && styles.txBorder]}
              >
                <View style={styles.txIcon}>
                  <Text style={styles.txEmoji}>{tx.icon}</Text>
                </View>
                <View style={styles.txDetails}>
                  <Text style={styles.txMerchant}>{tx.merchant}</Text>
                  <View style={styles.txMeta}>
                    <Text style={styles.txDate}>{tx.date}</Text>
                    <Text style={styles.txDot}> · </Text>
                    <View style={[styles.pocketTag, { backgroundColor: pocketColor + '22' }]}>
                      <Text style={[styles.pocketTagText, { color: pocketColor }]}>
                        {pocketName}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={[styles.txAmount, { color: tx.amount < 0 ? '#FF5252' : '#00D4AA' }]}>
                  {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                </Text>
              </View>
            );
          })}
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
