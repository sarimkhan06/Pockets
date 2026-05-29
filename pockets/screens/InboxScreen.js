import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';

import { API_URL } from '../lib/config';
import { formatDate } from '../lib/utils';
import { supabase } from '../lib/supabase';

export default function InboxScreen() {
  const [items, setItems] = useState([]);
  const [pockets, setPockets] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [overflowState, setOverflowState] = useState(null);
  // overflowState = { txId, primaryPocket, overflowAmount } when a transaction needs overflow handling
  const [pendingPocketId, setPendingPocketId] = useState(null);
  const [distributionMode, setDistributionMode] = useState('method');
  const [selectedSinglePocket, setSelectedSinglePocket] = useState(null);
  const [customAmounts, setCustomAmounts] = useState({});

  // Fetch unassigned transactions and pockets from the server on load
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        const [inboxRes, pocketsRes] = await Promise.all([
          fetch(`${API_URL}/transactions/inbox?userId=${userId}`),
          fetch(`${API_URL}/pockets?userId=${userId}`),
        ]);

        const inboxData = await inboxRes.json();
        const pocketsData = await pocketsRes.json();

        // Add status tracking to each transaction for the UI
        setItems(inboxData.map(tx => ({ ...tx, status: 'pending', selectedPocket: null })));
        setPockets(pocketsData);
      } catch (error) {
        console.error('Failed to load inbox:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    setDistributionMode('method');
    setSelectedSinglePocket(null);
    setCustomAmounts({});
  }, [expandedId]);

  const handleManual = (id) => {
    setExpandedId(expandedId === id ? null : id);
    setOverflowState(null);
  };

  const refreshPockets = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    const pocketsRes = await fetch(`${API_URL}/pockets?userId=${userId}`);
    setPockets(await pocketsRes.json());
  };

  const assignPocket = async (item, pocket) => {
    const txAmount = Math.abs(item.amount);

    // If the transaction exceeds what's in this pocket, go into overflow mode
    if (txAmount > pocket.balance) {
      setOverflowState({
        txId: item.id,
        primaryPocket: pocket,
        overflowAmount: txAmount - pocket.balance,
      });
      return;
    }

    // No overflow — assign normally
    setPendingPocketId(pocket.id);
    try {
      await fetch(`${API_URL}/transactions/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: item.id, pocketId: pocket.id }),
      });
      setItems(prev =>
        prev.map(i => i.id === item.id ? { ...i, status: 'manual', selectedPocket: pocket } : i)
      );
      setExpandedId(null);
      await refreshPockets();
    } catch (error) {
      console.error('Failed to assign pocket:', error);
    } finally {
      setPendingPocketId(null);
    }
  };

  const assignWithOverflow = async (txId, primaryPocket, overflowPocket) => {
    setPendingPocketId(overflowPocket.id);
    try {
      await fetch(`${API_URL}/transactions/assign-overflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: txId,
          primaryPocketId: primaryPocket.id,
          overflowPocketId: overflowPocket.id,
        }),
      });
      setItems(prev =>
        prev.map(i => i.id === txId ? { ...i, status: 'manual', selectedPocket: primaryPocket } : i)
      );
      setOverflowState(null);
      setExpandedId(null);
      await refreshPockets();
    } catch (error) {
      console.error('Failed to assign with overflow:', error);
    } finally {
      setPendingPocketId(null);
    }
  };

  // Splits income across pockets that have income_percent set, proportional to their stored percentages
  const calculateMethodDistribution = (income) => {
    const eligible = pockets.filter(p => p.income_percent != null);
    if (eligible.length === 0) return [];
    const totalPct = eligible.reduce((sum, p) => sum + p.income_percent, 0);
    if (totalPct === 0) return [];
    let remaining = income;
    return eligible.map((p, i) => {
      if (i === eligible.length - 1) return { ...p, share: Math.round(remaining * 100) / 100 };
      const share = Math.round((p.income_percent / totalPct) * income * 100) / 100;
      remaining -= share;
      return { ...p, share };
    });
  };

  const distributeIncome = async (item, distributions) => {
    setPendingPocketId('distributing');
    try {
      const res = await fetch(`${API_URL}/transactions/distribute-income`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: item.id, distributions }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        Alert.alert('Error', data.error || 'Something went wrong');
        return;
      }
      setItems(prev =>
        prev.map(i => i.id === item.id ? { ...i, status: 'distributed' } : i)
      );
      setExpandedId(null);
      await refreshPockets();
    } catch (error) {
      Alert.alert('Error', 'Could not reach the server. Is it running?');
    } finally {
      setPendingPocketId(null);
    }
  };

  const pending = items.filter(i => i.status === 'pending');
  const done = items.filter(i => i.status !== 'pending');

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    );
  }

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
            {pending.map(item => {
              const isIncome = item.amount > 0;
              const methodDist = isIncome ? calculateMethodDistribution(item.amount) : [];
              const totalCustom = pockets.reduce((sum, p) => sum + (parseFloat(customAmounts[p.id] || '0') || 0), 0);
              const isCustomValid = Math.abs(totalCustom - item.amount) < 0.01;
              const customDist = pockets
                .filter(p => parseFloat(customAmounts[p.id] || '0') > 0)
                .map(p => ({ pocketId: p.id, topUpAmount: parseFloat(customAmounts[p.id]) }));
              return (
              <View key={item.id}>
                <View style={styles.txCard}>
                  <View style={styles.txRow}>
                    <View style={styles.txIcon}>
                      <Text style={styles.txEmoji}>{item.icon}</Text>
                    </View>
                    <View style={styles.txDetails}>
                      <Text style={styles.txMerchant}>{item.merchant}</Text>
                      <Text style={styles.txDate}>{formatDate(item.date)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.txAmount, { color: isIncome ? '#00D4AA' : '#FF5252' }]}>
                        {isIncome ? '+' : '-'}${Math.abs(item.amount).toFixed(2)}
                      </Text>
                      {isIncome && (
                        <View style={styles.incomeBadge}>
                          <Text style={styles.incomeBadgeText}>income</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Action buttons */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.manualBtn, expandedId === item.id && styles.manualBtnActive]}
                      onPress={() => handleManual(item.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.manualBtnText}>
                        {isIncome ? 'Distribute' : 'Assign to Pocket'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Pocket picker (shown when Manual is tapped) */}
                  {expandedId === item.id && (
                    <View style={styles.pocketPicker}>
                      <TouchableOpacity onPress={() => { setExpandedId(null); setOverflowState(null); }} style={styles.pickerCancel}>
                        <Text style={styles.pickerCancelText}>✕ Cancel</Text>
                      </TouchableOpacity>
                      {isIncome ? (
                        <>
                          {/* Mode selector */}
                          <View style={styles.modeRow}>
                            {[
                              { key: 'method', label: 'By method' },
                              { key: 'all_in_one', label: 'All in one' },
                              { key: 'custom', label: 'Custom' },
                            ].map(m => (
                              <TouchableOpacity
                                key={m.key}
                                style={[styles.modeBtn, distributionMode === m.key && styles.modeBtnActive]}
                                onPress={() => setDistributionMode(m.key)}
                              >
                                <Text style={[styles.modeBtnText, distributionMode === m.key && styles.modeBtnTextActive]}>
                                  {m.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>

                          {distributionMode === 'method' && (
                            methodDist.length === 0 ? (
                              <Text style={styles.noMethodText}>
                                No pockets have income percentages set. Edit a pocket to configure this.
                              </Text>
                            ) : (
                              <>
                                <Text style={styles.pickerLabel}>Split +${item.amount.toFixed(2)} by your method</Text>
                                {methodDist.map(p => (
                                  <View key={p.id} style={styles.pickerRow}>
                                    <View style={[styles.pickerDot, { backgroundColor: p.color }]} />
                                    <Text style={styles.pickerName}>{p.name}</Text>
                                    <Text style={[styles.pickerLeft, { color: '#00D4AA' }]}>+${p.share.toFixed(2)}</Text>
                                  </View>
                                ))}
                                <TouchableOpacity
                                  style={[styles.distributeBtn, pendingPocketId === 'distributing' && { opacity: 0.7 }]}
                                  onPress={() => distributeIncome(item, methodDist.map(p => ({ pocketId: p.id, topUpAmount: p.share })))}
                                  disabled={pendingPocketId === 'distributing'}
                                  activeOpacity={0.8}
                                >
                                  {pendingPocketId === 'distributing'
                                    ? <ActivityIndicator size="small" color="#0B1120" />
                                    : <Text style={styles.distributeBtnText}>Confirm</Text>
                                  }
                                </TouchableOpacity>
                              </>
                            )
                          )}

                          {distributionMode === 'all_in_one' && (
                            <>
                              <Text style={styles.pickerLabel}>Choose one pocket for the full +${item.amount.toFixed(2)}</Text>
                              {pockets.map(p => (
                                <TouchableOpacity
                                  key={p.id}
                                  style={[styles.pickerRow, selectedSinglePocket?.id === p.id && styles.pickerRowSelected]}
                                  onPress={() => setSelectedSinglePocket(p)}
                                  activeOpacity={0.7}
                                >
                                  <View style={[styles.pickerDot, { backgroundColor: p.color }]} />
                                  <Text style={styles.pickerName}>{p.name}</Text>
                                  {selectedSinglePocket?.id === p.id && (
                                    <Text style={{ color: '#00D4AA', fontSize: 14, fontWeight: '700' }}>✓</Text>
                                  )}
                                </TouchableOpacity>
                              ))}
                              {selectedSinglePocket && (
                                <TouchableOpacity
                                  style={[styles.distributeBtn, pendingPocketId === 'distributing' && { opacity: 0.7 }]}
                                  onPress={() => distributeIncome(item, [{ pocketId: selectedSinglePocket.id, topUpAmount: item.amount }])}
                                  disabled={pendingPocketId === 'distributing'}
                                  activeOpacity={0.8}
                                >
                                  {pendingPocketId === 'distributing'
                                    ? <ActivityIndicator size="small" color="#0B1120" />
                                    : <Text style={styles.distributeBtnText}>Confirm</Text>
                                  }
                                </TouchableOpacity>
                              )}
                            </>
                          )}

                          {distributionMode === 'custom' && (
                            <>
                              <Text style={styles.pickerLabel}>Enter amounts for each pocket</Text>
                              {pockets.map(p => (
                                <View key={p.id} style={styles.pickerRow}>
                                  <View style={[styles.pickerDot, { backgroundColor: p.color }]} />
                                  <Text style={styles.pickerName}>{p.name}</Text>
                                  <View style={styles.customInputWrap}>
                                    <Text style={styles.customInputSign}>$</Text>
                                    <TextInput
                                      style={styles.customInput}
                                      keyboardType="numeric"
                                      value={customAmounts[p.id] || ''}
                                      onChangeText={v => setCustomAmounts(prev => ({ ...prev, [p.id]: v }))}
                                      placeholder="0"
                                      placeholderTextColor="#4A5E78"
                                    />
                                  </View>
                                </View>
                              ))}
                              <Text style={[styles.customTotal, isCustomValid ? { color: '#00D4AA' } : { color: '#8899AA' }]}>
                                Total: ${totalCustom.toFixed(2)} / ${item.amount.toFixed(2)}
                              </Text>
                              {isCustomValid && (
                                <TouchableOpacity
                                  style={[styles.distributeBtn, pendingPocketId === 'distributing' && { opacity: 0.7 }]}
                                  onPress={() => distributeIncome(item, customDist)}
                                  disabled={pendingPocketId === 'distributing'}
                                  activeOpacity={0.8}
                                >
                                  {pendingPocketId === 'distributing'
                                    ? <ActivityIndicator size="small" color="#0B1120" />
                                    : <Text style={styles.distributeBtnText}>Confirm</Text>
                                  }
                                </TouchableOpacity>
                              )}
                            </>
                          )}
                        </>
                      ) : overflowState?.txId === item.id ? (
                        // Overflow mode — pick a second pocket to cover the difference
                        <>
                          <View style={styles.overflowBanner}>
                            <Text style={styles.overflowText}>
                              {overflowState.primaryPocket.name} can only cover ${(Math.abs(item.amount) - overflowState.overflowAmount).toFixed(2)}.{'\n'}
                              Pick a pocket for the ${overflowState.overflowAmount.toFixed(2)} overflow:
                            </Text>
                          </View>
                          {pockets.filter(p => p.id !== overflowState.primaryPocket.id && p.balance >= overflowState.overflowAmount).length === 0 ? (
                            <Text style={styles.noOverflowText}>No pockets have enough balance to cover the ${overflowState.overflowAmount.toFixed(2)} overflow. Try increasing a pocket's budget.</Text>
                          ) : (
                            pockets
                              .filter(p => p.id !== overflowState.primaryPocket.id && p.balance >= overflowState.overflowAmount)
                              .map(pocket => (
                                <TouchableOpacity
                                  key={pocket.id}
                                  style={styles.pickerRow}
                                  onPress={() => assignWithOverflow(item.id, overflowState.primaryPocket, pocket)}
                                  activeOpacity={0.7}
                                  disabled={pendingPocketId !== null}
                                >
                                  <View style={[styles.pickerDot, { backgroundColor: pocket.color }]} />
                                  <Text style={styles.pickerName}>{pocket.name}</Text>
                                  {pendingPocketId === pocket.id
                                    ? <ActivityIndicator size="small" color="#00D4AA" />
                                    : <Text style={styles.pickerLeft}>${pocket.balance.toFixed(2)}</Text>
                                  }
                                </TouchableOpacity>
                              ))
                          )}
                        </>
                      ) : (
                        // Normal mode — pick which pocket this transaction belongs to
                        <>
                          <Text style={styles.pickerLabel}>Choose a pocket</Text>
                          {pockets.map(pocket => (
                            <TouchableOpacity
                              key={pocket.id}
                              style={styles.pickerRow}
                              onPress={() => assignPocket(item, pocket)}
                              activeOpacity={0.7}
                              disabled={pendingPocketId !== null}
                            >
                              <View style={[styles.pickerDot, { backgroundColor: pocket.color }]} />
                              <Text style={styles.pickerName}>{pocket.name}</Text>
                              {pendingPocketId === pocket.id
                                ? <ActivityIndicator size="small" color="#00D4AA" />
                                : <Text style={styles.pickerLeft}>${pocket.balance.toFixed(2)}</Text>
                              }
                            </TouchableOpacity>
                          ))}
                        </>
                      )}
                    </View>
                  )}
                </View>
              </View>
              );
            })}
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
                      {item.status === 'distributed'
                        ? <Text style={styles.resolvedDistributed}>💸 Distributed</Text>
                        : <Text style={styles.resolvedManual}>→ {item.selectedPocket?.name}</Text>
                      }
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
  pickerCancel: { alignSelf: 'flex-end', paddingVertical: 8, paddingLeft: 12 },
  pickerCancelText: { fontSize: 12, color: '#FF5252', fontWeight: '600' },
  pickerLabel: { fontSize: 11, color: '#8899AA', marginTop: 4, marginBottom: 8, fontWeight: '600' },
  overflowBanner: {
    backgroundColor: 'rgba(255,82,82,0.1)', borderRadius: 10,
    padding: 12, marginTop: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,82,82,0.2)',
  },
  overflowText: { fontSize: 13, color: '#FF5252', lineHeight: 20 },
  noOverflowText: { fontSize: 13, color: '#4A5E78', textAlign: 'center', paddingVertical: 16, lineHeight: 20 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  pickerDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  pickerName: { flex: 1, fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  pickerLeft: { fontSize: 12, color: '#8899AA' },

  incomeBadge: {
    backgroundColor: 'rgba(0,212,170,0.12)', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2, marginTop: 4,
  },
  incomeBadgeText: { fontSize: 10, color: '#00D4AA', fontWeight: '700', textTransform: 'uppercase' },

  distributeBtn: {
    backgroundColor: '#00D4AA', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', marginTop: 12, marginBottom: 4,
  },
  distributeBtnText: { fontSize: 14, fontWeight: '700', color: '#0B1120' },

  modeRow: { flexDirection: 'row', gap: 6, marginTop: 4, marginBottom: 12 },
  modeBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
    backgroundColor: '#1C2B45', borderWidth: 1, borderColor: 'transparent',
  },
  modeBtnActive: { borderColor: '#00D4AA' },
  modeBtnText: { fontSize: 12, fontWeight: '600', color: '#4A5E78' },
  modeBtnTextActive: { color: '#00D4AA' },
  noMethodText: { fontSize: 13, color: '#8899AA', textAlign: 'center', paddingVertical: 16, lineHeight: 20 },
  pickerRowSelected: { backgroundColor: 'rgba(0,212,170,0.06)', borderRadius: 8 },
  customInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  customInputSign: { fontSize: 14, color: '#8899AA' },
  customInput: {
    backgroundColor: '#1C2B45', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    fontSize: 14, color: '#FFFFFF', width: 72, textAlign: 'right',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  customTotal: { fontSize: 12, textAlign: 'right', marginTop: 8, fontWeight: '600' },

  resolvedTag: { marginTop: 2 },
  resolvedManual: { fontSize: 12, color: '#8899AA', fontWeight: '500' },
  resolvedDistributed: { fontSize: 12, color: '#00D4AA', fontWeight: '600' },
});
