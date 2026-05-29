import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { API_URL } from '../lib/config';
import { TEMPLATES } from '../data/onboardingData';

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

function TemplateStep({ onComplete, signUpUser, isRetake }) {
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
        body: JSON.stringify({ userId, methodId: selected.id }),
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OnboardingFlow({ onComplete, signUpUser, isRetake, onCancel }) {
  let content = (
    <TemplateStep
      onComplete={onComplete}
      signUpUser={signUpUser}
      isRetake={isRetake}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1120' }}>
      {content}
      {onCancel && (
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
});
