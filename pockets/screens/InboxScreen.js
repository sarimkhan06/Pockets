// InboxScreen.js — the most complex screen in the app.
//
// The inbox holds transactions that have arrived from Plaid but haven't been
// assigned to a pocket yet. The user reviews each one and decides where it goes.
//
// Two categories of inbox items:
//   EXPENSE (amount < 0) — e.g., a $50 grocery purchase
//     → User picks one pocket to charge it against
//     → OVERFLOW: if the pocket doesn't have enough balance, pick a second pocket
//       to cover the difference
//
//   INCOME (amount > 0) — e.g., a $3000 paycheck
//     → Three distribution modes:
//       "By method"   — auto-split using each pocket's income_percent setting
//       "All in one"  — put the entire amount into a single chosen pocket
//       "Custom"      — user types a dollar amount for each pocket manually
//
// State machine for each transaction:
//   status: 'pending'     → not yet handled by the user (shown in "Needs your attention")
//   status: 'manual'      → assigned to a specific pocket (expense)
//   status: 'distributed' → income split across multiple pockets

import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../lib/config';
import { formatDate, formatCurrency } from '../lib/utils';
import { supabase } from '../lib/supabase';

// onRefreshInboxCount is passed from MainNavigator so the tab badge updates after assignments
export default function InboxScreen({ onRefreshInboxCount }) {
  const [items, setItems] = useState([]);         // All inbox transactions (with status + selectedPocket added)
  const [pockets, setPockets] = useState([]);     // All user pockets (for picking where to assign)
  const [expandedId, setExpandedId] = useState(null); // Which transaction's picker panel is open
  const [loading, setLoading] = useState(true);

  // Overflow state: when an expense exceeds a pocket's balance, we enter overflow mode.
  // This holds: { txId, primaryPocket, overflowAmount }
  // primaryPocket already has partial funds; overflowAmount is the remainder to cover.
  const [overflowState, setOverflowState] = useState(null);

  const [pendingPocketId, setPendingPocketId] = useState(null); // ID of pocket currently being saved (shows spinner)

  // Income distribution mode — resets to 'method' whenever a different transaction is expanded
  const [distributionMode, setDistributionMode] = useState('method'); // 'method' | 'all_in_one' | 'custom'
  const [selectedSinglePocket, setSelectedSinglePocket] = useState(null); // For 'all_in_one' mode
  const [customAmounts, setCustomAmounts] = useState({}); // For 'custom' mode: { pocketId: '50.00', ... }

  // Reload every time the user navigates to this tab (a new transaction might have arrived)
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        setLoading(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const userId = session?.user?.id;

          const [inboxRes, pocketsRes] = await Promise.all([
            fetch(`${API_URL}/transactions/inbox?userId=${userId}`),
            fetch(`${API_URL}/pockets?userId=${userId}`),
          ]);

          const inboxData = await inboxRes.json();
          const pocketsData = await pocketsRes.json();

          // Add client-side status + selectedPocket to each transaction.
          // This lets us track what the user has done THIS session without
          // re-fetching from the server after every action.
          setItems(inboxData.map(tx => ({ ...tx, status: 'pending', selectedPocket: null })));
          // Exclude the Unsorted system pocket — users assign to named pockets only
          setPockets(pocketsData.filter(p => !p.is_unsorted));
          onRefreshInboxCount?.(userId); // Update the tab badge
        } catch (error) {
          console.error('Failed to load inbox:', error);
        } finally {
          setLoading(false);
        }
      };

      loadData();
    }, [])
  );

  // Reset the distribution controls whenever the user opens a different transaction's picker
  useEffect(() => {
    setDistributionMode('method');
    setSelectedSinglePocket(null);
    setCustomAmounts({});
  }, [expandedId]);

  // Toggle the expanded picker panel open/closed
  const handleManual = (id) => {
    setExpandedId(expandedId === id ? null : id);
    setOverflowState(null); // Clear any overflow state when closing
  };

  // Re-fetch pockets and update the tab badge after an assignment changes pocket balances
  const refreshPockets = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    const pocketsRes = await fetch(`${API_URL}/pockets?userId=${userId}`);
    const pocketsData = await pocketsRes.json();
    setPockets(pocketsData.filter(p => !p.is_unsorted));
    onRefreshInboxCount?.(userId);
  };

  // Handles assigning an EXPENSE transaction to a pocket.
  // If the pocket doesn't have enough balance, switches to overflow mode instead.
  const assignPocket = async (item, pocket) => {
    const txAmount = Math.abs(item.amount);

    // Check if this pocket can fully cover the expense
    if (txAmount > pocket.balance) {
      // Not enough — enter overflow mode. The UI will ask the user to pick a second pocket
      // to cover the difference (overflowAmount).
      setOverflowState({
        txId: item.id,
        primaryPocket: pocket,
        overflowAmount: txAmount - pocket.balance, // How much the primary pocket is short
      });
      return;
    }

    // Pocket has enough — do a normal single-pocket assignment
    setPendingPocketId(pocket.id); // Show spinner on this pocket's row
    try {
      await fetch(`${API_URL}/transactions/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: item.id, pocketId: pocket.id }),
      });
      // Update this item's status locally (no need to re-fetch the entire inbox list)
      setItems(prev =>
        prev.map(i => i.id === item.id ? { ...i, status: 'manual', selectedPocket: pocket } : i)
      );
      setExpandedId(null); // Close the picker
      await refreshPockets(); // Balances changed — update them
    } catch (error) {
      console.error('Failed to assign pocket:', error);
    } finally {
      setPendingPocketId(null);
    }
  };

  // Handles assigning an EXPENSE that overflows into two pockets.
  // The backend deducts the full primary pocket balance + the overflow from the secondary pocket.
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

  // Calculates how to split an income amount across pockets using their income_percent values.
  // Example: income = $3000, Needs=50%, Wants=30%, Savings=20%
  //   → Needs gets $1500, Wants gets $900, Savings gets $600
  // The last pocket gets the "remaining" amount to avoid rounding errors (e.g., $599.99 vs $600.00).
  const calculateMethodDistribution = (income) => {
    const eligible = pockets.filter(p => p.income_percent != null); // Only pockets with a % set
    if (eligible.length === 0) return [];

    // If percentages don't add up to 100, we normalize them (scale proportionally)
    const totalPct = eligible.reduce((sum, p) => sum + p.income_percent, 0);
    if (totalPct === 0) return [];

    let remaining = income;
    return eligible.map((p, i) => {
      // The last pocket gets whatever is left over to absorb rounding errors
      if (i === eligible.length - 1) return { ...p, share: Math.round(remaining * 100) / 100 };
      const share = Math.round((p.income_percent / totalPct) * income * 100) / 100;
      remaining -= share;
      return { ...p, share };
    });
  };

  // Sends the income distribution to the backend, which tops up each listed pocket.
  // distributions is an array of { pocketId, topUpAmount }
  const distributeIncome = async (item, distributions) => {
    setPendingPocketId('distributing'); // Special sentinel value — no single pocket is "pending"
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

  // Split items into two groups for the UI sections
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
        {/* Red badge showing the count of pending items */}
        {pending.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pending.length}</Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* All-clear state — nothing pending and nothing resolved */}
        {pending.length === 0 && done.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>✓</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              New transactions show up here after you sync. Assign each one to a pocket to keep your balances accurate.
            </Text>
          </View>
        )}

        {/* ── PENDING SECTION ──────────────────────────────────── */}
        {pending.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Needs your attention</Text>
            {pending.map(item => {
              const isIncome = item.amount > 0;

              // Pre-calculate values used in the picker UI
              const methodDist = isIncome ? calculateMethodDistribution(item.amount) : [];
              const totalCustom = pockets.reduce(
                (sum, p) => sum + (parseFloat(customAmounts[p.id] || '0') || 0), 0
              );
              // Custom distribution is valid when the amounts sum to the transaction amount (within $0.01)
              const isCustomValid = Math.abs(totalCustom - item.amount) < 0.01;
              const customDist = pockets
                .filter(p => parseFloat(customAmounts[p.id] || '0') > 0)
                .map(p => ({ pocketId: p.id, topUpAmount: parseFloat(customAmounts[p.id]) }));

              return (
              <View key={item.id}>
                <View style={styles.txCard}>
                  {/* Transaction summary row */}
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
                        {isIncome ? '+' : '-'}${formatCurrency(Math.abs(item.amount))}
                      </Text>
                      {/* "income" badge only shown for positive amounts */}
                      {isIncome && (
                        <View style={styles.incomeBadge}>
                          <Text style={styles.incomeBadgeText}>income</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* The "Distribute" / "Assign to Pocket" button — toggles the picker open/closed */}
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

                  {/* ── PICKER PANEL (shown when the button is tapped) ── */}
                  {expandedId === item.id && (
                    <View style={styles.pocketPicker}>
                      <TouchableOpacity
                        onPress={() => { setExpandedId(null); setOverflowState(null); }}
                        style={styles.pickerCancel}
                      >
                        <Text style={styles.pickerCancelText}>✕ Cancel</Text>
                      </TouchableOpacity>

                      {isIncome ? (
                        // ── INCOME PICKER ──────────────────────────────────
                        <>
                          {/* Mode selector: three tabs */}
                          <View style={styles.modeRow}>
                            {[
                              { key: 'method',    label: 'By method' },
                              { key: 'all_in_one', label: 'All in one' },
                              { key: 'custom',    label: 'Custom' },
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

                          {/* Mode: By method — auto-split based on income_percent */}
                          {distributionMode === 'method' && (
                            methodDist.length === 0 ? (
                              <Text style={styles.noMethodText}>
                                No pockets have income percentages set. Edit a pocket to configure this.
                              </Text>
                            ) : (
                              <>
                                <Text style={styles.pickerLabel}>Split +${formatCurrency(item.amount)} by your method</Text>
                                {methodDist.map(p => (
                                  <View key={p.id} style={styles.pickerRow}>
                                    <View style={[styles.pickerDot, { backgroundColor: p.color }]} />
                                    <Text style={styles.pickerName}>{p.name}</Text>
                                    <Text style={[styles.pickerLeft, { color: '#00D4AA' }]}>+${formatCurrency(p.share)}</Text>
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

                          {/* Mode: All in one — full amount goes to one selected pocket */}
                          {distributionMode === 'all_in_one' && (
                            <>
                              <Text style={styles.pickerLabel}>Choose one pocket for the full +${formatCurrency(item.amount)}</Text>
                              {pockets.map(p => (
                                <TouchableOpacity
                                  key={p.id}
                                  style={[styles.pickerRow, selectedSinglePocket?.id === p.id && styles.pickerRowSelected]}
                                  onPress={() => setSelectedSinglePocket(p)}
                                  activeOpacity={0.7}
                                >
                                  <View style={[styles.pickerDot, { backgroundColor: p.color }]} />
                                  <Text style={styles.pickerName}>{p.name}</Text>
                                  {/* Checkmark shown next to the selected pocket */}
                                  {selectedSinglePocket?.id === p.id && (
                                    <Text style={{ color: '#00D4AA', fontSize: 14, fontWeight: '700' }}>✓</Text>
                                  )}
                                </TouchableOpacity>
                              ))}
                              {/* Confirm button only appears once a pocket is selected */}
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

                          {/* Mode: Custom — user types a dollar amount per pocket */}
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
                                      // Update just this pocket's amount in the customAmounts object
                                      onChangeText={v => setCustomAmounts(prev => ({ ...prev, [p.id]: v }))}
                                      placeholder="0"
                                      placeholderTextColor="#4A5E78"
                                    />
                                  </View>
                                </View>
                              ))}
                              {/* Running total — turns green when it exactly matches the income amount */}
                              <Text style={[styles.customTotal, isCustomValid ? { color: '#00D4AA' } : { color: '#8899AA' }]}>
                                Total: ${formatCurrency(totalCustom)} / ${formatCurrency(item.amount)}
                              </Text>
                              {/* Confirm button only appears when the totals match */}
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
                        // ── OVERFLOW PICKER ─────────────────────────────────────────
                        // The primary pocket didn't have enough — pick a second pocket for the rest
                        <>
                          <View style={styles.overflowBanner}>
                            <Text style={styles.overflowText}>
                              {overflowState.primaryPocket.name} can only cover ${formatCurrency(Math.abs(item.amount) - overflowState.overflowAmount)}.{'\n'}
                              Pick a pocket for the ${formatCurrency(overflowState.overflowAmount)} overflow:
                            </Text>
                          </View>
                          {/* Only show pockets that have enough balance to cover the overflow amount */}
                          {pockets.filter(p => p.id !== overflowState.primaryPocket.id && p.balance >= overflowState.overflowAmount).length === 0 ? (
                            <Text style={styles.noOverflowText}>
                              No pockets have enough balance to cover the ${formatCurrency(overflowState.overflowAmount)} overflow. Try increasing a pocket's budget.
                            </Text>
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
                                    : <Text style={styles.pickerLeft}>${formatCurrency(pocket.balance)}</Text>
                                  }
                                </TouchableOpacity>
                              ))
                          )}
                        </>
                      ) : (
                        // ── NORMAL EXPENSE PICKER ────────────────────────────────────
                        // Show all pockets; tapping one calls assignPocket (may trigger overflow)
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
                                : <Text style={styles.pickerLeft}>${formatCurrency(pocket.balance)}</Text>
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

        {/* ── RESOLVED SECTION ─────────────────────────────────────── */}
        {/* Shows transactions the user already handled this session, dimmed out */}
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
                      {/* Show "💸 Distributed" for income, or "→ PocketName" for expenses */}
                      {item.status === 'distributed'
                        ? <Text style={styles.resolvedDistributed}>💸 Distributed</Text>
                        : <Text style={styles.resolvedManual}>→ {item.selectedPocket?.name}</Text>
                      }
                    </View>
                  </View>
                  <Text style={[styles.txAmount, { color: item.amount < 0 ? '#FF5252' : '#00D4AA' }]}>
                    {item.amount < 0 ? '-' : '+'}${formatCurrency(Math.abs(item.amount))}
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
  txCardDone: { opacity: 0.6 }, // Dimmed to show these are already handled
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
  manualBtnActive: { borderColor: '#00D4AA' }, // Green border when panel is open
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
