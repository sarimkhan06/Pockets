// MFASetupScreen.js — lets the user enable TOTP-based two-factor authentication.
//
// TOTP (Time-based One-Time Password) is the standard used by Google Authenticator,
// Authy, 1Password, etc. It works by sharing a secret key between the app and the
// authenticator — both use the same algorithm to generate a 6-digit code that
// changes every 30 seconds.
//
// The setup flow here:
//   1. On mount, call Supabase MFA enroll → get back a secret key + factorId
//   2. Display the secret key so the user can type it into their authenticator app
//   3. User enters the 6-digit code their authenticator shows
//   4. We call challengeAndVerify — if it matches, 2FA is now active on the account

import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function MFASetupScreen({ navigation }) {
  const [loading, setLoading] = useState(true);    // Spinner while enrolling
  const [secret, setSecret] = useState(null);      // The TOTP secret key shown to the user
  const [factorId, setFactorId] = useState(null);  // Supabase's ID for this factor
  const [code, setCode] = useState('');            // The 6-digit verification code
  const [verifying, setVerifying] = useState(false);

  // On mount, ask Supabase to enroll a new TOTP factor.
  // This generates a unique secret key tied to this user's account.
  useEffect(() => {
    const enroll = async () => {
      try {
        const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
        if (error) throw error;
        setSecret(data.totp.secret); // The secret the user needs to enter in their authenticator app
        setFactorId(data.id);
      } catch (e) {
        Alert.alert('Error', e.message || 'Failed to set up 2FA');
        navigation.goBack(); // Can't proceed without a secret, so go back
      } finally {
        setLoading(false);
      }
    };
    enroll();
  }, []);

  // Called when the user taps "Enable 2FA" after entering their authenticator code
  const handleVerify = async () => {
    if (code.length !== 6) return;
    setVerifying(true);
    try {
      // challengeAndVerify creates a challenge AND verifies the code in one step.
      // If the code is correct, Supabase marks this factor as verified and
      // the account now requires 2FA on every login.
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) throw error;
      Alert.alert('2FA Enabled', 'Two-factor authentication is now active on your account.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Invalid code', 'That code is incorrect. Please try again.');
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
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
        <Text style={styles.headerTitle}>Set Up 2FA</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Step 1: Add the secret to an authenticator app */}
        <Text style={styles.stepLabel}>Step 1</Text>
        <Text style={styles.title}>Add to authenticator app</Text>
        <Text style={styles.subtitle}>
          Open Google Authenticator (or Authy), tap the + button, choose "Enter a setup key", and type in the key below.
        </Text>

        {/* The secret key — selectable so the user can copy it */}
        <View style={styles.secretCard}>
          <Text style={styles.secretLabel}>Setup key — tap and hold to copy</Text>
          <Text style={styles.secretKey} selectable>{secret}</Text>
        </View>

        {/* Step 2: Confirm with the 6-digit code */}
        <Text style={[styles.stepLabel, { marginTop: 32 }]}>Step 2</Text>
        <Text style={styles.title}>Enter the 6-digit code</Text>
        <Text style={styles.subtitle}>
          After scanning, your app will show a 6-digit code. Enter it below to confirm setup.
        </Text>

        <TextInput
          style={styles.codeInput}
          value={code}
          // Strip non-digits and cap at 6 characters
          onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          placeholder="000000"
          placeholderTextColor="#4A5E78"
          maxLength={6}
          textAlign="center"
        />

        {/* Button is disabled until exactly 6 digits are entered */}
        <TouchableOpacity
          style={[styles.btn, (code.length !== 6 || verifying) && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={code.length !== 6 || verifying}
          activeOpacity={0.85}
        >
          {verifying
            ? <ActivityIndicator color="#0B1120" />
            : <Text style={styles.btnText}>Enable 2FA</Text>
          }
        </TouchableOpacity>

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

  stepLabel: {
    fontSize: 11, fontWeight: '700', color: '#00D4AA',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#8899AA', lineHeight: 20, marginBottom: 24 },

  secretCard: {
    backgroundColor: '#151F32', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  secretLabel: { fontSize: 11, color: '#8899AA', marginBottom: 6, fontWeight: '600' },
  secretKey: {
    fontSize: 13, color: '#00D4AA', fontWeight: '600',
    letterSpacing: 1, lineHeight: 20,
  },

  codeInput: {
    backgroundColor: '#151F32', borderRadius: 14,
    paddingVertical: 16, fontSize: 28, fontWeight: '800',
    color: '#FFFFFF', letterSpacing: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },

  btn: {
    backgroundColor: '#00D4AA', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#1C2B45' },
  btnText: { fontSize: 15, fontWeight: '700', color: '#0B1120' },
});
