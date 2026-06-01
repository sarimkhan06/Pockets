import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { create, open } from 'react-native-plaid-link-sdk';
import { supabase } from '../lib/supabase';
import { API_URL } from '../lib/config';
import { TEMPLATES } from '../data/onboardingData';
import { formatCurrency } from '../lib/utils';

// ─── Step 1: Monthly income ───────────────────────────────────────────────────

function IncomeStep({ onNext }) {
  const [income, setIncome] = useState('');
  const parsed = parseFloat(income);
  const canContinue = parsed > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.topSection}>
        <Text style={styles.stepLabel}>Step 1 of 2</Text>
        <Text style={styles.title}>What's your monthly income?</Text>
        <Text style={styles.subtitle}>We'll use this to size your pocket budgets automatically.</Text>
      </View>

      <View style={styles.incomeRow}>
        <Text style={styles.dollarSign}>$</Text>
        <TextInput
          style={styles.incomeInput}
          placeholder="0"
          placeholderTextColor="#4A5E78"
          keyboardType="numeric"
          value={income}
          onChangeText={setIncome}
          autoFocus
        />
      </View>
      <Text style={styles.incomeNote}>per month, after tax</Text>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, !canContinue && styles.btnDisabled]}
          onPress={() => canContinue && onNext(parsed)}
          disabled={!canContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>Next →</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Step 2: Template selection ───────────────────────────────────────────────

function TemplateStep({ onComplete, signUpUser, isRetake, currentMethodId }) {
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const templates = Object.values(TEMPLATES);
  const handleCreate = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      let userId = signUpUser?.id;
      if (!userId) {
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id;
      }
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id;
      }
      if (!userId) throw new Error('Could not get your account info. Please log in again.');

      if (isRetake) {
        await fetch(`${API_URL}/pockets/user/${userId}`, { method: 'DELETE' });
      }

      await fetch(`${API_URL}/user-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          methodId: selected.id,
          previousMethodId: isRetake ? currentMethodId : undefined,
        }),
      });

      const pockets = selected.pockets().map(p => ({
        ...p,
        balance: 0,
        user_id: userId,
      }));

      if (pockets.length > 0) {
        await fetch(`${API_URL}/pockets/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pockets }),
        });
      }

      if (isRetake) {
        try {
          await fetch(`${API_URL}/plaid/initialize-pocket-balances`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });
        } catch (e) {}
      }

      onComplete({ method: selected });
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.topSection}>
        <Text style={styles.stepLabel}>Almost done</Text>
        <Text style={styles.title}>Pick a template</Text>
        <Text style={styles.subtitle}>
          Pockets start at $0. Distribute your income when it arrives to fill them up.
        </Text>
      </View>

      <View style={styles.templateList}>
        {templates.map(t => {
          const pockets = t.pockets();
          const isSelected = selected?.id === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.templateCard,
                isSelected && { borderColor: t.color, backgroundColor: '#0D1E2E' },
              ]}
              onPress={() => setSelected(t)}
              activeOpacity={0.85}
            >
              <View style={styles.templateHeader}>
                <Text style={styles.templateIcon}>{t.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.templateName}>{t.name}</Text>
                  <Text style={styles.templateDesc}>{t.description}</Text>
                </View>
                <View style={[styles.radio, isSelected && { borderColor: t.color }]}>
                  {isSelected && <View style={[styles.radioDot, { backgroundColor: t.color }]} />}
                </View>
              </View>

              {pockets.length > 0 && (
                <View style={styles.pocketPreview}>
                  {pockets.map((p, i) => (
                    <View key={i} style={styles.previewRow}>
                      <View style={[styles.previewDot, { backgroundColor: p.color }]} />
                      <Text style={styles.previewName}>{p.name}</Text>
                      <Text style={[styles.previewAmount, { color: p.color }]}>
                        {p.income_percent}%
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {pockets.length === 0 && (
                <Text style={styles.blankNote}>You'll create your own pockets after setup.</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.btn, styles.createBtn, (!selected || saving) && styles.btnDisabled]}
        onPress={handleCreate}
        disabled={!selected || saving}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator color="#0B1120" />
          : <Text style={styles.btnText}>Create my pockets →</Text>
        }
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Step 3: Connect bank ─────────────────────────────────────────────────────

function ConnectBankStep({ signUpUser, onComplete }) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [bankBalance, setBankBalance] = useState(0);

  const getUserId = async () => {
    if (signUpUser?.id) return signUpUser.id;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id;
  };

  const syncTransactions = async (userId) => {
    setSyncing(true);
    try {
      await fetch(`${API_URL}/plaid/sync-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
    } catch (e) {
      // Non-fatal — user can sync manually from Settings
    } finally {
      setSyncing(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const userId = await getUserId();
      const res = await fetch(`${API_URL}/plaid/create-link-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const { link_token, error } = await res.json();
      if (error) throw new Error(error);

      create({ token: link_token });
      open({
        onSuccess: async (success) => {
          try {
            const exchangeRes = await fetch(`${API_URL}/plaid/exchange-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ publicToken: success.publicToken, userId }),
            });
            const exchangeData = await exchangeRes.json();
            if (exchangeData.error) throw new Error(exchangeData.error);

            // Fill pockets with the user's real bank balance before syncing transactions
            const initRes = await fetch(`${API_URL}/plaid/initialize-pocket-balances`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId }),
            });
            const initData = await initRes.json();
            if (initData.error) throw new Error(initData.error);

            setBankBalance(initData.totalBalance || 0);
            setConnected(true);
            await syncTransactions(userId);
          } catch (e) {
            Alert.alert('Error', e.message || 'Failed to save bank connection');
          } finally {
            setConnecting(false);
          }
        },
        onExit: (exit) => {
          if (exit.error) {
            Alert.alert('Error', exit.error.display_message || 'Something went wrong with Plaid');
          }
          setConnecting(false);
        },
      });
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to start bank connection');
      setConnecting(false);
    }
  };

  const features = [
    { icon: '⚡', title: 'Real transactions', desc: 'Transactions appear in your inbox to assign to pockets.' },
    { icon: '🔒', title: 'Bank-level security', desc: 'Plaid is trusted by thousands of apps and millions of users.' },
    { icon: '👁', title: 'Read-only access', desc: 'We can only read your transactions — we cannot move money.' },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.topSection}>
        <Text style={styles.stepLabel}>Last step</Text>
        <Text style={styles.title}>Connect your bank</Text>
        <Text style={styles.subtitle}>
          Link your bank so your real transactions flow into your pockets automatically.
        </Text>
      </View>

      <View style={styles.bankHero}>
        <View style={[styles.bankIcon, connected && styles.bankIconConnected]}>
          <Text style={styles.bankEmoji}>{connected ? '✓' : '🏦'}</Text>
        </View>
        {connected && (
          <Text style={styles.bankConnectedLabel}>
            {syncing ? 'Syncing your transactions…' : 'Bank connected!'}
          </Text>
        )}
      </View>

      {!connected && (
        <View style={styles.featuresCard}>
          {features.map((f, i) => (
            <View key={i} style={[styles.featureRow, i < 2 && styles.featureBorder]}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.bankFooter}>
        {connected ? (
          <TouchableOpacity
            style={[styles.btn, styles.bankContinueBtn, syncing && styles.btnDisabled]}
            onPress={() => onComplete(bankBalance)}
            disabled={syncing}
            activeOpacity={0.85}
          >
            {syncing
              ? <ActivityIndicator color="#0B1120" />
              : <Text style={styles.btnText}>Continue →</Text>
            }
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.btn, styles.bankContinueBtn, connecting && styles.btnDisabled]}
              onPress={handleConnect}
              disabled={connecting}
              activeOpacity={0.85}
            >
              {connecting
                ? <ActivityIndicator color="#0B1120" />
                : <Text style={styles.btnText}>Connect with Plaid</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Step 4: Set up custom pockets (blank template only) ─────────────────────

const POCKET_COLORS = ['#00D4AA', '#FF5252', '#448AFF', '#FF9F43', '#B39DDB', '#FF6B9D', '#00BCD4', '#8BC34A'];

function SetupPocketsStep({ bankBalance, signUpUser, onComplete }) {
  const [rows, setRows] = useState([
    { id: 1, name: '', amount: '', color: POCKET_COLORS[0] },
  ]);
  const [saving, setSaving] = useState(false);

  const totalAllocated = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const remaining = Math.round((bankBalance - totalAllocated) * 100) / 100;

  const addRow = () => {
    const color = POCKET_COLORS[rows.length % POCKET_COLORS.length];
    setRows(prev => [...prev, { id: Date.now(), name: '', amount: '', color }]);
  };

  const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));

  const updateRow = (id, field, value) => {
    if (field === 'amount') {
      const otherTotal = rows.reduce((sum, r) => r.id !== id ? sum + (parseFloat(r.amount) || 0) : sum, 0);
      const max = Math.max(0, bankBalance - otherTotal);
      const parsed = parseFloat(value) || 0;
      if (parsed > max) value = String(Math.round(max * 100) / 100);
    }
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleDone = async () => {
    const valid = rows.filter(r => r.name.trim() && parseFloat(r.amount) > 0);
    if (valid.length === 0) {
      Alert.alert('Add at least one pocket', 'Give it a name and an amount.');
      return;
    }
    setSaving(true);
    try {
      let userId = signUpUser?.id;
      if (!userId) {
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id;
      }
      await fetch(`${API_URL}/pockets/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pockets: valid.map(r => ({
            name: r.name.trim(),
            balance: parseFloat(r.amount),
            color: r.color,
            income_percent: null,
            user_id: userId,
          })),
        }),
      });
      onComplete();
    } catch (e) {
      Alert.alert('Error', 'Failed to create pockets. Please try again.');
      setSaving(false);
    }
  };

  const canDone = remaining === 0 && rows.some(r => r.name.trim() && parseFloat(r.amount) > 0) && !saving;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.topSection}>
        <Text style={styles.stepLabel}>Last step</Text>
        <Text style={styles.title}>Set up your pockets</Text>
        <Text style={styles.subtitle}>
          Divide your ${formatCurrency(bankBalance)} bank balance across your spending categories.
        </Text>
      </View>

      <View style={styles.remainingCard}>
        <Text style={styles.remainingLabel}>Remaining to allocate</Text>
        <Text style={styles.remainingAmount}>
          ${formatCurrency(remaining)}
        </Text>
      </View>

      <View style={styles.setupList}>
        {rows.map((r) => (
          <View key={r.id} style={styles.setupRow}>
            <View style={[styles.setupDot, { backgroundColor: r.color }]} />
            <TextInput
              style={styles.setupName}
              placeholder="Pocket name"
              placeholderTextColor="#4A5E78"
              value={r.name}
              onChangeText={v => updateRow(r.id, 'name', v)}
            />
            <Text style={styles.setupSign}>$</Text>
            <TextInput
              style={styles.setupAmount}
              placeholder="0"
              placeholderTextColor="#4A5E78"
              keyboardType="numeric"
              value={r.amount}
              onChangeText={v => updateRow(r.id, 'amount', v)}
            />
            {rows.length > 1 && (
              <TouchableOpacity onPress={() => removeRow(r.id)} style={styles.setupRemove}>
                <Text style={styles.setupRemoveText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.addRowBtn} onPress={addRow} activeOpacity={0.7}>
        <Text style={styles.addRowBtnText}>+ Add another pocket</Text>
      </TouchableOpacity>

      <View style={[styles.bankFooter, { marginTop: 24 }]}>
        <TouchableOpacity
          style={[styles.btn, styles.bankContinueBtn, !canDone && styles.btnDisabled]}
          onPress={handleDone}
          disabled={!canDone}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#0B1120" />
            : <Text style={styles.btnText}>Done →</Text>
          }
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Step 5: Set up 2FA ───────────────────────────────────────────────────────

function MFAStep({ onComplete }) {
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState(null);
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const enroll = async () => {
      try {
        const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
        if (error) throw error;
        setSecret(data.totp.secret);
        setFactorId(data.id);
      } catch (e) {
        Alert.alert('Error', e.message || 'Failed to set up 2FA. You can enable it later in Settings.');
        onComplete();
      } finally {
        setLoading(false);
      }
    };
    enroll();
  }, []);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setVerifying(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) throw error;
      onComplete();
    } catch (e) {
      Alert.alert('Invalid code', 'That code is incorrect. Please try again.');
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B1120', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0B1120' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.topSection}>
          <Text style={styles.stepLabel}>Security</Text>
          <Text style={styles.title}>Secure your account</Text>
          <Text style={styles.subtitle}>
            Since your bank is now connected, we strongly recommend enabling two-factor authentication. Without it, anyone who gets your password can access your financial data.
          </Text>
        </View>

        <View style={styles.mfaWarningCard}>
          <Text style={styles.mfaWarningText}>
            🔒 Highly recommended — your account contains sensitive financial data. Skipping this puts your account at risk.
          </Text>
        </View>

        <View style={[styles.topSection, { paddingTop: 16, paddingBottom: 8 }]}>
          <Text style={styles.subtitle}>
            Open any authenticator app (Authy, Microsoft Authenticator, 1Password, etc.), tap + or "Add account", choose "Enter a setup key", and type in the key below.
          </Text>
        </View>

        <View style={styles.mfaSecretCard}>
          <Text style={styles.mfaSecretLabel}>Setup key — tap and hold to copy</Text>
          <Text style={styles.mfaSecretKey} selectable>{secret}</Text>
        </View>

        <View style={styles.mfaCodeSection}>
          <Text style={styles.mfaCodeLabel}>Enter the 6-digit code from your app to confirm</Text>
          <TextInput
            style={styles.mfaCodeInput}
            value={code}
            onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="000000"
            placeholderTextColor="#4A5E78"
            maxLength={6}
            textAlign="center"
          />
        </View>

        <View style={styles.bankFooter}>
          <TouchableOpacity
            style={[styles.btn, styles.bankContinueBtn, (code.length !== 6 || verifying) && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={code.length !== 6 || verifying}
            activeOpacity={0.85}
          >
            {verifying
              ? <ActivityIndicator color="#0B1120" />
              : <Text style={styles.btnText}>Enable 2FA →</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OnboardingFlow({ onComplete, signUpUser, isRetake, currentMethodId, onCancel }) {
  const [step, setStep] = useState('template'); // 'template' | 'bank' | 'setup' | 'mfa'
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [bankBalance, setBankBalance] = useState(0);

  const handleTemplateComplete = ({ method }) => {
    setSelectedMethod(method);
    if (isRetake) {
      onComplete({ method });
    } else {
      setStep('bank');
    }
  };

  const handleBankComplete = (balance) => {
    if (selectedMethod?.id === 'blank' && balance > 0) {
      setBankBalance(balance);
      setStep('setup');
    } else {
      setStep('mfa');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1120' }}>
      {step === 'template' && (
        <TemplateStep
          onComplete={handleTemplateComplete}
          signUpUser={signUpUser}
          isRetake={isRetake}
          currentMethodId={currentMethodId}
        />
      )}
      {step === 'bank' && (
        <ConnectBankStep
          signUpUser={signUpUser}
          onComplete={handleBankComplete}
        />
      )}
      {step === 'setup' && (
        <SetupPocketsStep
          bankBalance={bankBalance}
          signUpUser={signUpUser}
          onComplete={() => setStep('mfa')}
        />
      )}
      {step === 'mfa' && (
        <MFAStep onComplete={() => onComplete({ method: selectedMethod })} />
      )}
      {onCancel && step === 'template' && (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.cancelBtnText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },

  topSection: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 32 },
  stepLabel: {
    fontSize: 12, fontWeight: '700', color: '#00D4AA',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 10 },
  subtitle: { fontSize: 15, color: '#8899AA', lineHeight: 22 },

  incomeRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginTop: 16,
  },
  dollarSign: { fontSize: 40, fontWeight: '700', color: '#8899AA', marginRight: 6 },
  incomeInput: {
    fontSize: 56, fontWeight: '800', color: '#FFFFFF',
    minWidth: 120, letterSpacing: -1,
  },
  incomeNote: { textAlign: 'center', fontSize: 13, color: '#4A5E78', marginTop: 10 },

  footer: { paddingHorizontal: 24, paddingVertical: 24 },
  btn: {
    backgroundColor: '#00D4AA', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#1C2B45' },
  btnText: { fontSize: 15, fontWeight: '700', color: '#0B1120' },
  createBtn: { marginHorizontal: 24, marginTop: 8 },

  templateList: { paddingHorizontal: 20, gap: 12 },
  templateCard: {
    backgroundColor: '#151F32', borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)', padding: 16,
  },
  templateHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  templateIcon: { fontSize: 26, marginTop: 2 },
  templateName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 3 },
  templateDesc: { fontSize: 13, color: '#8899AA', lineHeight: 18 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: '#4A5E78', alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  radioDot: { width: 11, height: 11, borderRadius: 6 },

  pocketPreview: {
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', gap: 8,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center' },
  previewDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  previewName: { flex: 1, fontSize: 13, color: '#CCDDEE', fontWeight: '500' },
  previewAmount: { fontSize: 13, fontWeight: '700' },
  blankNote: { fontSize: 13, color: '#4A5E78', marginTop: 12, fontStyle: 'italic' },

  cancelBtn: {
    position: 'absolute', top: 20, right: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#151F32', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  cancelBtnText: { fontSize: 14, color: '#8899AA', fontWeight: '600' },

  // ConnectBankStep styles
  bankHero: { alignItems: 'center', paddingVertical: 24 },
  bankIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#151F32', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  bankIconConnected: { backgroundColor: '#0D2820', borderColor: '#00D4AA' },
  bankEmoji: { fontSize: 36 },
  bankConnectedLabel: { fontSize: 16, fontWeight: '700', color: '#00D4AA' },

  featuresCard: {
    marginHorizontal: 20, backgroundColor: '#151F32', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 24, overflow: 'hidden',
  },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 16 },
  featureBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  featureIcon: { fontSize: 22, marginRight: 14, marginTop: 2 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 3 },
  featureDesc: { fontSize: 13, color: '#8899AA', lineHeight: 18 },

  bankFooter: { paddingHorizontal: 24 },
  bankContinueBtn: { marginBottom: 0 },
  skipBtn: { paddingVertical: 16, alignItems: 'center' },
  skipText: { fontSize: 14, color: '#4A5E78', fontWeight: '500' },

  // SetupPocketsStep styles
  remainingCard: {
    marginHorizontal: 24, backgroundColor: '#151F32', borderRadius: 16,
    padding: 18, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
  },
  remainingLabel: { fontSize: 12, color: '#8899AA', fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  remainingAmount: { fontSize: 32, fontWeight: '800', color: '#00D4AA', letterSpacing: -0.5 },
  remainingOver: { color: '#FF5252' },

  setupList: { paddingHorizontal: 20, gap: 10 },
  setupRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#151F32', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 10,
  },
  setupDot: { width: 12, height: 12, borderRadius: 6 },
  setupName: {
    flex: 1, fontSize: 14, color: '#FFFFFF',
    paddingVertical: 2,
  },
  setupSign: { fontSize: 14, color: '#8899AA' },
  setupAmount: {
    width: 80, fontSize: 14, color: '#FFFFFF', textAlign: 'right',
    backgroundColor: '#1C2B45', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  setupRemove: { paddingLeft: 4 },
  setupRemoveText: { fontSize: 20, color: '#4A5E78', lineHeight: 22 },

  addRowBtn: { marginHorizontal: 20, marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  addRowBtnText: { fontSize: 14, color: '#00D4AA', fontWeight: '600' },

  mfaWarningCard: {
    marginHorizontal: 24, backgroundColor: 'rgba(255,159,67,0.1)', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: 'rgba(255,159,67,0.3)', marginBottom: 8,
  },
  mfaWarningText: { fontSize: 13, color: '#FF9F43', lineHeight: 20, fontWeight: '500' },

  mfaSecretCard: {
    marginHorizontal: 24, backgroundColor: '#151F32', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: 'rgba(0,212,170,0.2)', marginBottom: 24,
  },
  mfaSecretLabel: { fontSize: 11, fontWeight: '700', color: '#8899AA', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  mfaSecretKey: { fontSize: 15, color: '#00D4AA', fontWeight: '700', letterSpacing: 1.5, lineHeight: 24 },

  mfaCodeSection: { paddingHorizontal: 24, marginBottom: 24 },
  mfaCodeLabel: { fontSize: 13, color: '#8899AA', marginBottom: 12, lineHeight: 18 },
  mfaCodeInput: {
    backgroundColor: '#151F32', borderRadius: 14,
    paddingVertical: 16, fontSize: 28, fontWeight: '800',
    color: '#FFFFFF', letterSpacing: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
});
