import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';

import { API_URL } from '../lib/config';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';

const COLORS = ['#00D4AA', '#FF5252', '#448AFF', '#FF9F43', '#B39DDB', '#FF6B9D', '#00BCD4', '#8BC34A'];

export default function EditPocketScreen({ route, navigation, onRefreshInboxCount }) {
  const { pocket } = route.params;
  const [name, setName] = useState(pocket.name);
  const [balance, setBalance] = useState(String(pocket.balance));
  const [selectedColor, setSelectedColor] = useState(pocket.color);
  const [loading, setLoading] = useState(false);
  const [includeInDist, setIncludeInDist] = useState(pocket.income_percent != null);
  const [incomePercent, setIncomePercent] = useState(pocket.income_percent != null ? String(pocket.income_percent) : '');
  const [otherPockets, setOtherPockets] = useState([]);
  const [transferAmounts, setTransferAmounts] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTransferAmounts, setDeleteTransferAmounts] = useState({});

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/pockets?userId=${session?.user?.id}`);
      const data = await res.json();
      setOtherPockets(Array.isArray(data) ? data.filter(p => p.id !== pocket.id) : []);
    };
    load();
  }, []);

  const newBalance = parseFloat(balance) || 0;
  const diff = newBalance - pocket.balance;
  const needsTransfer = Math.abs(diff) >= 0.01;
  const isAdding = diff > 0; // increasing this pocket → take from others
  const totalTransferred = Object.values(transferAmounts)
    .reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const transferComplete = Math.abs(totalTransferred - Math.abs(diff)) < 0.01;
  const totalAvailable = isAdding
    ? otherPockets.reduce((sum, p) => sum + p.balance, 0)
    : Infinity;
  const insufficientFunds = isAdding && totalAvailable < diff;

  const handleBalanceChange = (val) => {
    setBalance(val);
    setTransferAmounts({});
  };

  const updateTransferAmount = (pocketId, val, maxAllowed) => {
    const parsed = parseFloat(val) || 0;
    const otherTotal = Object.entries(transferAmounts)
      .reduce((sum, [id, v]) => id !== pocketId ? sum + (parseFloat(v) || 0) : sum, 0);
    let cap = Math.max(0, Math.abs(diff) - otherTotal);
    if (maxAllowed !== null) cap = Math.min(cap, maxAllowed);
    if (parsed > cap) val = String(Math.round(cap * 100) / 100);
    setTransferAmounts(prev => ({ ...prev, [pocketId]: val }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const transfers = Object.entries(transferAmounts)
        .filter(([, v]) => parseFloat(v) > 0)
        .map(([pocketId, v]) => ({
          pocketId,
          amount: isAdding ? -parseFloat(v) : parseFloat(v), // negative = losing, positive = gaining
        }));
      await fetch(`${API_URL}/pockets/${pocket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          balance: newBalance,
          color: selectedColor,
          income_percent: includeInDist ? (parseFloat(incomePercent) || null) : null,
          transfers: needsTransfer ? transfers : undefined,
        }),
      });
      navigation.navigate('Dashboard');
    } catch (error) {
      Alert.alert('Error', 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const hasBalance = pocket.balance > 0;
  const totalDeleteTransferred = Object.values(deleteTransferAmounts)
    .reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const deleteTransferComplete = Math.abs(totalDeleteTransferred - pocket.balance) < 0.01;
  const canConfirmDelete = !hasBalance || deleteTransferComplete;

  const updateDeleteAmount = (pocketId, val) => {
    const parsed = parseFloat(val) || 0;
    const otherTotal = Object.entries(deleteTransferAmounts)
      .reduce((sum, [id, v]) => id !== pocketId ? sum + (parseFloat(v) || 0) : sum, 0);
    const max = Math.max(0, pocket.balance - otherTotal);
    if (parsed > max) val = String(Math.round(max * 100) / 100);
    setDeleteTransferAmounts(prev => ({ ...prev, [pocketId]: val }));
  };

  const confirmDelete = async () => {
    setLoading(true);
    try {
      const transfers = Object.entries(deleteTransferAmounts)
        .filter(([, v]) => parseFloat(v) > 0)
        .map(([pocketId, v]) => ({ pocketId, amount: parseFloat(v) }));
      await fetch(`${API_URL}/pockets/${pocket.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transfers }),
      });
      const { data: { session } } = await supabase.auth.getSession();
      onRefreshInboxCount?.(session?.user?.id);
      navigation.navigate('Dashboard');
    } catch (e) {
      Alert.alert('Error', 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const canSave = name.trim().length > 0 && (!needsTransfer || (transferComplete && !insufficientFunds)) && !loading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Pocket</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.previewCard}>
          <View style={[styles.previewTopBar, { backgroundColor: selectedColor }]} />
          <Text style={styles.previewName}>{name || 'Pocket name'}</Text>
          <Text style={[styles.previewAmount, { color: selectedColor }]}>
            ${formatCurrency(newBalance)}
          </Text>
          <Text style={styles.previewLabel}>balance</Text>
        </View>

        <View style={styles.form}>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pocket Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Groceries, Rent..."
              placeholderTextColor="#4A5E78"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Balance</Text>
            <View style={styles.amountRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={[styles.input, styles.amountInput]}
                value={balance}
                onChangeText={handleBalanceChange}
                placeholder="0.00"
                placeholderTextColor="#4A5E78"
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Transfer section — only shown when balance changed */}
          {needsTransfer && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {isAdding
                  ? `Take $${formatCurrency(Math.abs(diff))} from`
                  : `Send $${formatCurrency(Math.abs(diff))} to`
                }
              </Text>
              {insufficientFunds && (
                <View style={styles.noTransferCard}>
                  <Text style={styles.noTransferText}>
                    Not enough funds across your other pockets. You need ${formatCurrency(diff)} but only ${formatCurrency(totalAvailable)} is available.
                  </Text>
                </View>
              )}
              {otherPockets.length === 0 ? (
                <View style={styles.noTransferCard}>
                  <Text style={styles.noTransferText}>No other pockets to take from.</Text>
                </View>
              ) : insufficientFunds ? null : (
                <>
                  {otherPockets.map(p => {
                    const maxAllowed = isAdding ? p.balance : null;
                    const hasEnough = !isAdding || p.balance > 0;
                    return (
                      <View key={p.id} style={[styles.pocketOption, !hasEnough && styles.pocketOptionDim]}>
                        <View style={[styles.pocketDot, { backgroundColor: p.color }]} />
                        <Text style={styles.pocketOptionName}>{p.name}</Text>
                        <Text style={styles.pocketOptionBalance}>${formatCurrency(p.balance)}</Text>
                        <View style={styles.transferInputWrap}>
                          <Text style={styles.transferInputSign}>$</Text>
                          <TextInput
                            style={styles.transferInput}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#4A5E78"
                            editable={hasEnough}
                            value={transferAmounts[p.id] || ''}
                            onChangeText={v => updateTransferAmount(p.id, v, maxAllowed)}
                          />
                        </View>
                      </View>
                    );
                  })}
                  {transferComplete ? (
                    <Text style={[styles.transferTotal, styles.transferTotalDone]}>
                      Fully allocated
                    </Text>
                  ) : (
                    <Text style={[styles.transferTotal, styles.transferTotalPending]}>
                      Remaining: ${formatCurrency(Math.abs(diff) - totalTransferred)}
                    </Text>
                  )}
                </>
              )}
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Color</Text>
            <View style={styles.colorRow}>
              {COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorDot, { backgroundColor: color }, selectedColor === color && styles.colorDotSelected]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Income Distribution</Text>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Include in income split</Text>
              <Switch
                value={includeInDist}
                onValueChange={setIncludeInDist}
                trackColor={{ false: '#1C2B45', true: 'rgba(0,212,170,0.4)' }}
                thumbColor={includeInDist ? '#00D4AA' : '#4A5E78'}
              />
            </View>
            {includeInDist && (
              <View style={[styles.amountRow, { marginTop: 10 }]}>
                <TextInput
                  style={[styles.input, styles.amountInput]}
                  placeholder="0"
                  placeholderTextColor="#4A5E78"
                  keyboardType="numeric"
                  value={incomePercent}
                  onChangeText={setIncomePercent}
                />
                <Text style={styles.percentSign}>% of income</Text>
              </View>
            )}
          </View>

        </View>

        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#0B1120" />
            : <Text style={styles.saveBtnText}>Save Changes</Text>
          }
        </TouchableOpacity>

        {!showDeleteConfirm ? (
          <TouchableOpacity style={styles.deleteBtn} onPress={() => setShowDeleteConfirm(true)} activeOpacity={0.85}>
            <Text style={styles.deleteBtnText}>Delete Pocket</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.deleteConfirm}>
            <Text style={styles.deleteConfirmTitle}>Delete "{pocket.name}"?</Text>
            <Text style={styles.deleteConfirmNote}>
              All transactions assigned to this pocket will return to your inbox.
            </Text>

            {hasBalance && (
              <>
                <Text style={styles.deleteConfirmLabel}>
                  Distribute ${formatCurrency(pocket.balance)} across your pockets
                </Text>
                {otherPockets.length === 0 ? (
                  <Text style={styles.deleteConfirmEmpty}>
                    No other pockets — this balance will be lost.
                  </Text>
                ) : (
                  <>
                    {otherPockets.map(p => (
                      <View key={p.id} style={styles.pocketOption}>
                        <View style={[styles.pocketDot, { backgroundColor: p.color }]} />
                        <Text style={styles.pocketOptionName}>{p.name}</Text>
                        <View style={styles.transferInputWrap}>
                          <Text style={styles.transferInputSign}>$</Text>
                          <TextInput
                            style={styles.transferInput}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#4A5E78"
                            value={deleteTransferAmounts[p.id] || ''}
                            onChangeText={v => updateDeleteAmount(p.id, v)}
                          />
                        </View>
                      </View>
                    ))}
                    {deleteTransferComplete ? (
                      <Text style={[styles.transferTotal, styles.transferTotalDone]}>
                        Fully allocated
                      </Text>
                    ) : (
                      <Text style={[styles.transferTotal, styles.transferTotalPending]}>
                        Remaining: ${formatCurrency(pocket.balance - totalDeleteTransferred)}
                      </Text>
                    )}
                  </>
                )}
              </>
            )}

            <TouchableOpacity
              style={[styles.deleteConfirmBtn, !canConfirmDelete && styles.saveBtnDisabled]}
              onPress={confirmDelete}
              disabled={!canConfirmDelete || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.deleteConfirmBtnText}>Confirm Delete</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDeleteConfirm(false)} style={styles.deleteCancelLink}>
              <Text style={styles.deleteCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  headerSpacer: { width: 38 },

  previewCard: {
    marginHorizontal: 20, backgroundColor: '#151F32', borderRadius: 20,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 24, paddingBottom: 20,
  },
  previewTopBar: { height: 5, width: '100%', marginBottom: 16 },
  previewName: { fontSize: 16, color: '#8899AA', paddingHorizontal: 20, marginBottom: 4 },
  previewAmount: { fontSize: 36, fontWeight: '800', paddingHorizontal: 20, letterSpacing: -0.5 },
  previewLabel: { fontSize: 12, color: '#4A5E78', paddingHorizontal: 20 },

  form: { paddingHorizontal: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#8899AA', marginBottom: 8 },
  input: {
    backgroundColor: '#151F32', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#FFFFFF',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', flex: 1,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  dollarSign: { fontSize: 20, color: '#8899AA', marginRight: 8 },
  amountInput: { flex: 1 },

  noTransferCard: {
    backgroundColor: '#151F32', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  noTransferText: { fontSize: 13, color: '#4A5E78', lineHeight: 20 },

  pocketOption: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#151F32', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  pocketOptionDim: { opacity: 0.4 },
  pocketDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  pocketOptionName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  pocketOptionBalance: { fontSize: 12, color: '#4A5E78', marginRight: 10 },
  transferInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  transferInputSign: { fontSize: 14, color: '#8899AA' },
  transferInput: {
    backgroundColor: '#1C2B45', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    fontSize: 14, color: '#FFFFFF', width: 72, textAlign: 'right',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  transferTotal: { fontSize: 13, fontWeight: '600', textAlign: 'right', marginTop: 4 },
  transferTotalDone: { color: '#00D4AA' },
  transferTotalPending: { color: '#8899AA' },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotSelected: { borderWidth: 3, borderColor: '#FFFFFF' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 14, color: '#FFFFFF' },
  percentSign: { fontSize: 14, color: '#8899AA', marginLeft: 8 },

  saveBtn: {
    marginHorizontal: 20, backgroundColor: '#00D4AA',
    borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12,
  },
  saveBtnDisabled: { backgroundColor: '#1C2B45' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#0B1120' },
  deleteBtn: {
    marginHorizontal: 20, backgroundColor: 'transparent',
    borderRadius: 16, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#FF5252',
  },
  deleteBtnText: { fontSize: 15, fontWeight: '700', color: '#FF5252' },

  deleteConfirm: {
    marginHorizontal: 20, backgroundColor: '#1C0A0A', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,82,82,0.3)', padding: 20,
  },
  deleteConfirmTitle: { fontSize: 16, fontWeight: '700', color: '#FF5252', marginBottom: 8 },
  deleteConfirmNote: { fontSize: 13, color: '#8899AA', lineHeight: 20, marginBottom: 16 },
  deleteConfirmLabel: { fontSize: 12, fontWeight: '600', color: '#8899AA', marginBottom: 8 },
  deleteConfirmEmpty: { fontSize: 13, color: '#FF5252', marginBottom: 16 },
  deleteConfirmBtn: {
    backgroundColor: '#FF5252', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 16,
  },
  deleteConfirmBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  deleteCancelLink: { paddingVertical: 12, alignItems: 'center' },
  deleteCancelText: { fontSize: 14, color: '#4A5E78', fontWeight: '500' },
});
