import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function ChangePasswordScreen({ navigation }) {
  const [step, setStep] = useState('loading'); // 'loading' | 'mfa' | 'password'
  const [factorId, setFactorId] = useState(null);
  const [challengeId, setChallengeId] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const checkMFA = async () => {
      try {
        const { data } = await supabase.auth.mfa.listFactors();
        const totp = data?.totp?.[0];
        if (totp) {
          const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: totp.id });
          setFactorId(totp.id);
          setChallengeId(challenge.id);
          setStep('mfa');
        } else {
          setStep('password');
        }
      } catch (e) {
        setStep('password');
      }
    };
    checkMFA();
  }, []);

  const handleMFAVerify = async () => {
    setVerifying(true);
    try {
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: mfaCode });
      if (error) throw error;
      setStep('password');
    } catch (e) {
      Alert.alert('Invalid code', 'That code is incorrect. Please try again.');
      setMfaCode('');
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Too short', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please make sure both passwords are the same.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert('Password updated', 'Your password has been changed successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  if (step === 'loading') {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {step === 'mfa' && (
          <>
            <Text style={styles.title}>Verify your identity</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code from your authenticator app to continue.
            </Text>
            <TextInput
              style={styles.codeInput}
              value={mfaCode}
              onChangeText={v => setMfaCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="000000"
              placeholderTextColor="#4A5E78"
              maxLength={6}
              textAlign="center"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.btn, (mfaCode.length !== 6 || verifying) && styles.btnDisabled]}
              onPress={handleMFAVerify}
              disabled={mfaCode.length !== 6 || verifying}
              activeOpacity={0.85}
            >
              {verifying
                ? <ActivityIndicator color="#0B1120" />
                : <Text style={styles.btnText}>Verify</Text>
              }
            </TouchableOpacity>
          </>
        )}

        {step === 'password' && (
          <>
            <Text style={styles.title}>New password</Text>
            <Text style={styles.subtitle}>Choose a strong password for your account.</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="••••••••"
                placeholderTextColor="#4A5E78"
                secureTextEntry
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={[
                  styles.input,
                  confirmPassword.length > 0 && confirmPassword !== newPassword && styles.inputError,
                ]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor="#4A5E78"
                secureTextEntry
              />
              {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                <Text style={styles.errorText}>Passwords don't match</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.btn, (newPassword.length < 6 || newPassword !== confirmPassword || saving) && styles.btnDisabled]}
              onPress={handleSave}
              disabled={newPassword.length < 6 || newPassword !== confirmPassword || saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#0B1120" />
                : <Text style={styles.btnText}>Update Password</Text>
              }
            </TouchableOpacity>
          </>
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

  content: { paddingHorizontal: 24, paddingTop: 8 },

  title: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#8899AA', lineHeight: 20, marginBottom: 24 },

  codeInput: {
    backgroundColor: '#151F32', borderRadius: 14,
    paddingVertical: 16, fontSize: 28, fontWeight: '800',
    color: '#FFFFFF', letterSpacing: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#8899AA', marginBottom: 6 },
  input: {
    backgroundColor: '#151F32', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, color: '#FFFFFF',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  inputError: { borderColor: '#FF5252' },
  errorText: { fontSize: 12, color: '#FF5252', marginTop: 4 },

  btn: {
    backgroundColor: '#00D4AA', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { backgroundColor: '#1C2B45' },
  btnText: { fontSize: 15, fontWeight: '700', color: '#0B1120' },
});
