import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { inboxTransactions, pockets } from '../data/mockData';

export default function InboxScreen() {
  const [items, setItems] = useState(
    inboxTransactions.map(tx => ({ ...tx, status: 'pending', selectedPocket: null }))
  );
  const [expandedId, setExpandedId] = useState(null);

  const handleAI = (id) => {
    setItems(prev =>
      prev.map(item => item.id === id ? { ...item, status: 'ai' } : item)
    );
    setExpandedId(null);
  };

  const handleManual = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const assignPocket = (txId, pocket) => {
    setItems(prev =>
      prev.map(item =>
        item.id === txId ? { ...item, status: 'manual', selectedPocket: pocket } : item
      )
    );
    setExpandedId(null);
  };

  const pending = items.filter(i => i.status === 'pending');
  const done = items.filter(i => i.status !== 'pending');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inbox</Text>
        {pending.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pending.length}</Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {pending.length === 0 && done.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>✓</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>No new transactions to review.</Text>
          </View>
        )}

        {/* Pending transactions */}
        {pending.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Needs your attention</Text>
            {pending.map(item => (
              <View key={item.id}>
                <View style={styles.txCard}>
                  <View style={styles.txRow}>
                    <View style={styles.txIcon}>
                      <Text style={styles.txEmoji}>{item.icon}</Text>
                    </View>
                    <View style={styles.txDetails}>
                      <Text style={styles.txMerchant}>{item.merchant}</Text>
                      <Text style={styles.txDate}>{item.date}</Text>
                    </View>
                    <Text style={[styles.txAmount, { color: item.amount < 0 ? '#FF5252' : '#00D4AA' }]}>
                      {item.amount < 0 ? '-' : '+'}${Math.abs(item.amount).toFixed(2)}
                    </Text>
                  </View>

                  {/* Action buttons */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.aiBtn}
                      onPress={() => handleAI(item.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.aiBtnEmoji}>✦</Text>
                      <Text style={styles.aiBtnText}>AI Assign</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.manualBtn, expandedId === item.id && styles.manualBtnActive]}
                      onPress={() => handleManual(item.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.manualBtnText}>Manual</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Pocket picker (shown when Manual is tapped) */}
                  {expandedId === item.id && (
                    <View style={styles.pocketPicker}>
                      <Text style={styles.pickerLabel}>Choose a pocket</Text>
                      {pockets.map(pocket => (
                        <TouchableOpacity
                          key={pocket.id}
                          style={styles.pickerRow}
                          onPress={() => assignPocket(item.id, pocket)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.pickerDot, { backgroundColor: pocket.color }]} />
                          <Text style={styles.pickerName}>{pocket.name}</Text>
                          <Text style={styles.pickerLeft}>
                            ${pocket.budget - pocket.spent} left
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ))}
          </>
        )}

        {/* Resolved transactions */}
        {done.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Resolved</Text>
            {done.map(item => (
              <View key={item.id} style={[styles.txCard, styles.txCardDone]}>
                <View style={styles.txRow}>
                  <View style={styles.txIcon}>
                    <Text style={styles.txEmoji}>{item.icon}</Text>
                  </View>
                  <View style={styles.txDetails}>
                    <Text style={styles.txMerchant}>{item.merchant}</Text>
                    <View style={styles.resolvedTag}>
                      {item.status === 'ai' ? (
                        <Text style={styles.resolvedAI}>✦ AI assigned</Text>
                      ) : (
                        <Text style={styles.resolvedManual}>
                          → {item.selectedPocket?.name}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.txAmount, { color: item.amount < 0 ? '#FF5252' : '#00D4AA' }]}>
                    {item.amount < 0 ? '-' : '+'}${Math.abs(item.amount).toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </>
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
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 10,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  badge: {
    backgroundColor: '#FF5252', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: '#8899AA' },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#8899AA',
    textTransform: 'uppercase', letterSpacing: 1,
    paddingHorizontal: 20, marginTop: 8, marginBottom: 10,
  },

  txCard: {
    marginHorizontal: 20, backgroundColor: '#151F32', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 10, overflow: 'hidden',
  },
  txCardDone: { opacity: 0.6 },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  txIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#1C2B45', alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  txEmoji: { fontSize: 18 },
  txDetails: { flex: 1 },
  txMerchant: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 2 },
  txDate: { fontSize: 12, color: '#8899AA' },
  txAmount: { fontSize: 14, fontWeight: '700' },

  actionRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingBottom: 14,
  },
  aiBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00D4AA', borderRadius: 10, paddingVertical: 10, gap: 6,
  },
  aiBtnEmoji: { fontSize: 12, color: '#0B1120' },
  aiBtnText: { fontSize: 13, fontWeight: '700', color: '#0B1120' },
  manualBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1C2B45', borderRadius: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  manualBtnActive: { borderColor: '#00D4AA' },
  manualBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },

  pocketPicker: {
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  pickerLabel: { fontSize: 11, color: '#8899AA', marginTop: 12, marginBottom: 8, fontWeight: '600' },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  pickerDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  pickerName: { flex: 1, fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  pickerLeft: { fontSize: 12, color: '#8899AA' },

  resolvedTag: { marginTop: 2 },
  resolvedAI: { fontSize: 12, color: '#00D4AA', fontWeight: '600' },
  resolvedManual: { fontSize: 12, color: '#8899AA', fontWeight: '500' },
});
