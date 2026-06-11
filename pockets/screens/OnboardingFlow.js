// OnboardingFlow.js — the multi-step setup experience for new users.
//
// This file defines 5 inner "step" components and one main orchestrator component.
// Each step is a self-contained component that calls onComplete/onNext when done.
// The orchestrator (OnboardingFlow) tracks which step is active and transitions between them.
//
// Step flow:
//   New user:     template → bank → [setup if blank] → mfa → done
//   Retake (change template): template → done (bank already connected, skip the rest)
//
// Why are steps separate components (not separate screens)?
//   They share the same onboarding-specific styles and all live in a single
//   animation-free flow. Separate screens would add unnecessary navigation stack entries.

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
// NOTE: This step is defined but not currently in the active flow.
// It was built for future use (auto-sizing pocket budgets based on income).

function IncomeStep({ onNext }) {
  const [income, setIncome] = useState('');
  const parsed = parseFloat(income);
  const canContinue = parsed > 0; // Disable "Next" until a positive number is entered

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
// User picks a budgeting method. On confirmation:
//   1. Delete existing pockets (fresh start)
//   2. Save the method ID to user-settings
//   3. Create the template's default pockets (all at $0 balance)
//   4. If retake, also initialize pocket balances from Plaid immediately

function TemplateStep({ onComplete, signUpUser, isRetake, currentMethodId }) {
  const [selected, setSelected] = useState(null); // The currently highlighted template
  const [saving, setSaving] = useState(false);

  // Convert the TEMPLATES object into an array for rendering
  const templates = Object.values(TEMPLATES);

  const handleCreate = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      // Get the userId — from signUpUser prop (new user) or from active session (returning user)
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

      // 1. Delete all existing pockets for this user (fresh start with the new template)
      await fetch(`${API_URL}/pockets/user/${userId}`, { method: 'DELETE' });

      // 2. Save the chosen method to the database.
      //    If it's a retake, also save the PREVIOUS method ID so a backup can be offered.
      await fetch(`${API_URL}/user-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          methodId: selected.id,
          previousMethodId: isRetake ? currentMethodId : undefined,
        }),
      });

      // 3. Create the template's default pockets (all start at $0 — bank funds them later)
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

      // 4. For retakes: the bank is already connected, so initialize balances immediately.
      //    For new users: ConnectBankStep handles this after they link their bank.
      if (isRetake) {
        try {
          await fetch(`${API_URL}/plaid/initialize-pocket-balances`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });
        } catch (e) {} // Non-fatal for retakes
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
          const pockets = t.pockets(); // Call the function to get the pocket list
          const isSelected = selected?.id === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.templateCard,
                // Highlight the card with the template's color when selected
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
                {/* Radio button — shows a dot when this template is selected */}
                <View style={[styles.radio, isSelected && { borderColor: t.color }]}>
                  {isSelected && <View style={[styles.radioDot, { backgroundColor: t.color }]} />}
                </View>
              </View>

              {/* Preview the pockets this template would create */}
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

              {/* Blank template: no pockets to preview */}
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
// Same 3-step Plaid flow as ConnectBankScreen, but also:
//   - Initializes pocket balances using the user's real bank balance
//   - Auto-syncs transactions after connecting

function ConnectBankStep({ signUpUser, onComplete }) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [bankBalance, setBankBalance] = useState(0); // Used to size pockets in the blank template

  const getUserId = async () => {
    if (signUpUser?.id) return signUpUser.id; // Prefer the signUpUser from the fresh sign-up
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id;
  };

  // Pull transactions after connecting — non-fatal if it fails, user can sync manually
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

      // Step 1: Create a link token from our backend
      const res = await fetch(`${API_URL}/plaid/create-link-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const { link_token, error } = await res.json();
      if (error) throw new Error(error);

      // Step 2: Launch the Plaid Link native UI
      create({ token: link_token });
      open({
        onSuccess: async (success) => {
          try {
            // Step 3: Exchange the public token for a permanent access token
            const exchangeRes = await fetch(`${API_URL}/plaid/exchange-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ publicToken: success.publicToken, userId }),
            });
            const exchangeData = await exchangeRes.json();
            if (exchangeData.error) throw new Error(exchangeData.error);

            // Initialize pocket balances from the real bank total balance.
            // This splits the account balance proportionally across pockets using income_percent.
            const initRes = await fetch(`${API_URL}/plaid/initialize-pocket-balances`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId }),
            });
            const initData = await initRes.json();
            if (initData.error) throw new Error(initData.error);

            setBankBalance(initData.totalBalance || 0);
            setConnected(true);
            await syncTransactions(userId); // Pull initial transaction history
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
        <Text style={styles.stepLabel}>Almost there</Text>
        <Text style={styles.title}>Connect your bank</Text>
        <Text style={styles.subtitle}>
          Link your bank so your real transactions flow into your pockets automatically.
        </Text>
      </View>

      {/* Bank connection status icon */}
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

      {/* Feature list — hidden once connected */}
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
          // After connecting, pass bankBalance to the orchestrator so it knows
          // whether to show SetupPocketsStep (blank template needs manual setup)
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
// Only shown when the user chose "Start Blank" AND has a bank balance > $0.
// The user divides their entire bank balance across custom-named pockets.
// The "Done" button is only enabled when the remaining balance hits exactly $0.

const POCKET_COLORS = ['#00D4AA', '#FF5252', '#448AFF', '#FF9F43', '#B39DDB', '#FF6B9D', '#00BCD4', '#8BC34A'];

function SetupPocketsStep({ bankBalance, signUpUser, onComplete }) {
  // Each row represents one pocket-to-be: { id, name, amount, color }
  const [rows, setRows] = useState([
    { id: 1, name: '', amount: '', color: POCKET_COLORS[0] },
  ]);
  const [saving, setSaving] = useState(false);

  // How much of the bank balance has been allocated across all rows
  const totalAllocated = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  // How much still needs to be assigned ($0 = ready to submit)
  const remaining = Math.round((bankBalance - totalAllocated) * 100) / 100;

  // Add a new row with the next color in the cycle
  const addRow = () => {
    const color = POCKET_COLORS[rows.length % POCKET_COLORS.length];
    setRows(prev => [...prev, { id: Date.now(), name: '', amount: '', color }]);
  };

  const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));

  // Update a specific field on a specific row.
  // For 'amount', enforce a cap so the user can't allocate more than they have.
  const updateRow = (id, field, value) => {
    if (field === 'amount') {
      // Sum of all OTHER rows' amounts (not this one)
      const otherTotal = rows.reduce((sum, r) => r.id !== id ? sum + (parseFloat(r.amount) || 0) : sum, 0);
      const max = Math.max(0, bankBalance - otherTotal); // Max this row can take
      const parsed = parseFloat(value) || 0;
      if (parsed > max) value = String(Math.round(max * 100) / 100); // Clamp
    }
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleDone = async () => {
    // Only save rows that have both a name and a positive amount
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
      // Save all the new pockets in one batch API call
      await fetch(`${API_URL}/pockets/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pockets: valid.map(r => ({
            name: r.name.trim(),
            balance: parseFloat(r.amount),
            color: r.color,
            income_percent: null, // Blank template: no income distribution by default
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

  // "Done" is only enabled when remaining === 0 AND at least one valid row exists
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

      {/* Live "remaining" counter — turns green at $0 */}
      <View style={styles.remainingCard}>
        <Text style={styles.remainingLabel}>Remaining to allocate</Text>
        <Text style={styles.remainingAmount}>
          ${formatCurrency(remaining)}
        </Text>
      </View>

      {/* Editable rows: one per pocket-to-be */}
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
            {/* × button — only shown when there's more than one row */}
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
// Strongly encouraged after bank connection since the account now contains financial data.
// Same logic as MFASetupScreen — enrolls a TOTP factor and verifies it with a code.

function MFAStep({ onComplete }) {
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState(null);
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Enroll immediately on mount so the secret is ready when the screen renders
  useEffect(() => {
    const enroll = async () => {
      try {
        const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
        if (error) throw error;
        setSecret(data.totp.secret);
        setFactorId(data.id);
      } catch (e) {
        // If enrollment fails (e.g., factor already exists), skip 2FA setup
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
      onComplete(); // 2FA verified — finish onboarding
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
          <Text style={styles.stepLabel}>Last step</Text>
          <Text style={styles.title}>Secure your account</Text>
          <Text style={styles.subtitle}>
            Since your bank is now connected, we strongly recommend enabling two-factor authentication. Without it, anyone who gets your password can access your financial data.
          </Text>
        </View>

        {/* Warning card — amber color to convey urgency without being alarming */}
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

        {/* The secret key — selectable so user can copy it */}
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

// ─── Main orchestrator ────────────────────────────────────────────────────────
// Controls which step is active and handles transitions between them.
// All step components only know about their own onComplete/onNext callback —
// they don't know what comes next. This component decides that.

export default function OnboardingFlow({ onComplete, signUpUser, isRetake, currentMethodId, onCancel }) {
  // The current step in the flow
  const [step, setStep] = useState('template'); // 'template' | 'bank' | 'setup' | 'mfa'
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [bankBalance, setBankBalance] = useState(0); // Passed to SetupPocketsStep

  // Called when TemplateStep completes
  const handleTemplateComplete = ({ method }) => {
    setSelectedMethod(method);
    if (isRetake) {
      // Retake: bank already connected, skip to done
      onComplete({ method });
    } else {
      setStep('bank'); // New user: go to bank connection
    }
  };

  // Called when ConnectBankStep completes (receives the user's total bank balance)
  const handleBankComplete = (balance) => {
    if (selectedMethod?.id === 'blank' && balance > 0) {
      // Blank template: user needs to manually divide their balance into pockets
      setBankBalance(balance);
      setStep('setup');
    } else {
      // Pre-built template: pockets already created with income_percent → skip to MFA
      setStep('mfa');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1120' }}>
      {/* Render only the active step */}
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
          onComplete={() => setStep('mfa')} // After manual setup, go to 2FA
        />
      )}
      {step === 'mfa' && (
        <MFAStep onComplete={() => onComplete({ method: selectedMethod })} />
      )}
      {/* Cancel button — only shown for retakes (not new users), and only on the first step */}
      {onCancel && step === 'template' && (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.cancelBtnText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Shared styles (used across all step components in this file) ─────────────
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
