// LoginScreen.js — handles sign up, log in, forgot password, and MFA verification.
//
// This screen has two modes controlled by `isSignUp`:
//   false → Login form (email + password)
//   true  → Sign-up form (full name + email + password + confirm password)
//
// And two steps controlled by `step`:
//   'auth' → Show the login/signup form
//   'mfa'  → After a successful login, if the user has 2FA enabled, show the code entry
//
// MFA (Multi-Factor Authentication) flow:
//   1. User submits email + password → Supabase checks credentials
//   2. We ask Supabase: "does this user have 2FA enrolled?" (getAuthenticatorAssuranceLevel)
//   3. If yes, create a "challenge" (a short-lived token) and show the 6-digit code screen
//   4. User enters code from their authenticator app → we verify it → onLogin() fires

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

// Custom SVG-like logo made entirely from React Native View and Text components.
// No external image file needed — it's just rectangles + circles positioned absolutely.
const LogoIcon = () => (
  <View style={{ width: 40, height: 32, position: 'relative' }}>
    {/* Back pocket — offset right, semi-transparent to look behind the front one */}
    <View style={{
      position: 'absolute',
      width: 22, height: 20,
      borderWidth: 2.5, borderTopWidth: 0,
      borderColor: 'rgba(11,17,32,0.35)',
      borderBottomLeftRadius: 7, borderBottomRightRadius: 7,
      top: 10, left: 16,
    }} />
    {/* Coin above back pocket */}
    <View style={{
      position: 'absolute',
      width: 13, height: 13, borderRadius: 7,
      backgroundColor: 'rgba(11,17,32,0.35)',
      alignItems: 'center', justifyContent: 'center',
      top: 2, left: 21,
    }}>
      <Text style={{ fontSize: 8, fontWeight: '900', color: '#00D4AA' }}>$</Text>
    </View>
    {/* Front pocket — solid color, covers the back pocket slightly */}
    <View style={{
      position: 'absolute',
      width: 22, height: 20,
      borderWidth: 2.5, borderTopWidth: 0,
      borderColor: '#0B1120',
      borderBottomLeftRadius: 7, borderBottomRightRadius: 7,
      top: 6, left: 2,
    }} />
    {/* Coin above front pocket */}
    <View style={{
      position: 'absolute',
      width: 13, height: 13, borderRadius: 7,
      backgroundColor: '#0B1120',
      alignItems: 'center', justifyContent: 'center',
      top: 0, left: 7,
    }}>
      <Text style={{ fontSize: 8, fontWeight: '900', color: '#00D4AA' }}>$</Text>
    </View>
  </View>
);

// onLogin → callback to App.js to transition to the main screen
// onSignUp → callback to App.js to transition to onboarding with the new user object
export default function LoginScreen({ onLogin, onSignUp }) {
  const [isSignUp, setIsSignUp] = useState(false);      // Toggle between login and sign-up forms
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);         // Disables button and shows spinner while waiting

  // MFA step — these only matter after a successful login where the user has 2FA enabled
  const [step, setStep] = useState('auth');        // 'auth' = show login form, 'mfa' = show code input
  const [mfaCode, setMfaCode] = useState('');
  const [factorId, setFactorId] = useState(null);  // Supabase ID for the user's TOTP factor
  const [challengeId, setChallengeId] = useState(null); // Supabase ID for this specific challenge attempt

  // Called when the user taps "Log In" or "Create Account"
  const handleSubmit = async () => {
    // Guard: passwords must match before we even attempt sign-up
    if (isSignUp && password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please make sure both passwords are the same.');
      return;
    }

    setLoading(true);

    if (isSignUp) {
      // supabase.auth.signUp creates a new account.
      // options.data.full_name saves the name into user_metadata (attached to the user object).
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (error) {
        Alert.alert('Sign up failed', error.message);
      } else if (!data.user) {
        // Supabase returns null for data.user if the email is already registered
        Alert.alert('Already registered', 'This email already has an account. Try logging in instead.');
      } else {
        // Pass the new user object up to App.js so it can be used during onboarding
        onSignUp(data.user);
      }
    } else {
      // supabase.auth.signInWithPassword validates email + password against Supabase
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        Alert.alert('Login failed', error.message);
      } else {
        // Login succeeded. Now check if this user has 2FA enrolled.
        // getAuthenticatorAssuranceLevel tells us the current vs required security level:
        //   aal1 = password only (current)
        //   aal2 = password + MFA (required if user enrolled 2FA)
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData.nextLevel === 'aal2' && aalData.nextLevel !== aalData.currentLevel) {
          // User has 2FA but hasn't verified it yet for this session — show the code screen
          const { data: factorsData } = await supabase.auth.mfa.listFactors();
          // Pick the verified factor specifically — enrolling (even an abandoned attempt)
          // can leave unverified leftover factors on the account, and checking against one
          // of those would never match the code in the user's actual authenticator app.
          const totp = factorsData.totp.find(f => f.status === 'verified') || factorsData.totp[0];
          if (totp) {
            // Create a challenge: this is a short-lived token that authorizes one verification attempt
            const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: totp.id });
            setFactorId(totp.id);
            setChallengeId(challenge.id);
            setStep('mfa'); // Switch UI to the 6-digit code input
          } else {
            onLogin(); // No factors found despite aal2 requirement — log in anyway
          }
        } else {
          onLogin(); // No MFA required — go straight to the app
        }
      }
    }

    setLoading(false);
  };

  // Sends a password reset email when the user taps "Forgot password?"
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Type your email address in the field above first.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'http://192.168.2.140:3000/reset-password', // The backend URL that handles the reset
      });
      if (error) throw error;
      Alert.alert('Check your email', `We sent a password reset link to ${email.trim()}.`);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to send reset email.');
    } finally {
      setLoading(false); // 'finally' runs whether the try succeeded or threw an error
    }
  };

  // Called when the user submits the 6-digit MFA code
  const handleMFAVerify = async () => {
    setLoading(true);
    try {
      // supabase.auth.mfa.verify checks the code against the challenge we created earlier.
      // If it matches, the session is elevated to aal2 and the user is fully authenticated.
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: mfaCode });
      if (error) throw error;
      onLogin(); // MFA passed — transition to the main app
    } catch (e) {
      Alert.alert('Invalid code', 'That code is incorrect. Please try again.');
      setMfaCode(''); // Clear the code field so user can try again
      // The old challenge may have expired by now — get a fresh one so the next
      // attempt has a real chance, instead of retrying against a dead challenge.
      try {
        const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
        setChallengeId(challenge.id);
      } catch (e2) {}
    } finally {
      setLoading(false);
    }
  };

  // If we're on the MFA step, render only the code input (not the login form)
  if (step === 'mfa') {
    return (
      // KeyboardAvoidingView pushes the form up when the keyboard appears,
      // preventing the input from being hidden behind the keyboard.
      // The behavior differs between iOS ('padding') and Android ('height').
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.inner}>
          <View style={styles.logoArea}>
            <View style={styles.logoCircle}>
              <LogoIcon />
            </View>
            <Text style={styles.appName}>Pockets</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Two-Factor Auth</Text>
            <Text style={styles.mfaSubtitle}>
              Open your authenticator app and enter the 6-digit code for Pockets.
            </Text>

            <TextInput
              style={styles.codeInput}
              value={mfaCode}
              // v.replace(/\D/g, '') removes any non-digit characters (e.g., spaces, letters)
              // .slice(0, 6) enforces a maximum length of 6 digits
              onChangeText={v => setMfaCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="000000"
              placeholderTextColor="#4A5E78"
              maxLength={6}
              textAlign="center"
              autoFocus  // Automatically focus this input when the screen appears
            />

            {/* Button is disabled until exactly 6 digits are entered */}
            <TouchableOpacity
              style={[styles.button, (mfaCode.length !== 6 || loading) && styles.buttonDisabled]}
              onPress={handleMFAVerify}
              disabled={mfaCode.length !== 6 || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#0B1120" />
                : <Text style={styles.buttonText}>Verify</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setStep('auth'); setMfaCode(''); }} style={styles.switchRow}>
              <Text style={styles.switchText}>
                <Text style={styles.switchLink}>← Back to login</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Default: render the login or sign-up form
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>

        {/* Logo and tagline */}
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <LogoIcon />
          </View>
          <Text style={styles.appName}>Pockets</Text>
          <Text style={styles.tagline}>Your money, your way.</Text>
        </View>

        {/* The card container holds all the form inputs */}
        <View style={styles.card}>
          {/* The title changes based on which mode we're in */}
          <Text style={styles.cardTitle}>{isSignUp ? 'Create account' : 'Welcome back'}</Text>

          {/* Full name input — only shown for sign-up */}
          {isSignUp && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor="#4A5E78"
                autoCapitalize="words"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@email.com"
              placeholderTextColor="#4A5E78"
              keyboardType="email-address"
              autoCapitalize="none" // Prevents iOS from auto-capitalizing email addresses
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#4A5E78"
              secureTextEntry // Hides the text as dots/asterisks
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Confirm password — only shown for sign-up, with live validation feedback */}
          {isSignUp && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={[
                  styles.input,
                  // Add a red border if there's text but it doesn't match the password
                  confirmPassword.length > 0 && confirmPassword !== password && styles.inputError,
                ]}
                placeholder="••••••••"
                placeholderTextColor="#4A5E78"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              {/* Show error text only when there's a mismatch — gives immediate feedback */}
              {confirmPassword.length > 0 && confirmPassword !== password && (
                <Text style={styles.errorText}>Passwords don't match</Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#0B1120" />
              : <Text style={styles.buttonText}>{isSignUp ? 'Create Account' : 'Log In'}</Text>
            }
          </TouchableOpacity>

          {/* Forgot password link — only on login, not sign-up */}
          {!isSignUp && (
            <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotRow}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {/* Toggle between login and sign-up modes */}
          <TouchableOpacity
            onPress={() => {
              setIsSignUp(prev => !prev); // prev is the current value — !prev flips it
              setConfirmPassword('');
              setFullName('');
            }}
            style={styles.switchRow}
          >
            <Text style={styles.switchText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.switchLink}>{isSignUp ? 'Log in' : 'Sign up'}</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  inner: {
    flex: 1,
    justifyContent: 'center', // Centers the logo + card vertically
    paddingHorizontal: 24,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#00D4AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: '#8899AA',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#151F32',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8899AA',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1C2B45',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  inputError: {
    borderColor: '#FF5252',
  },
  errorText: {
    fontSize: 12,
    color: '#FF5252',
    marginTop: 4,
  },
  button: {
    backgroundColor: '#00D4AA',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B1120',
  },
  switchRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  switchText: {
    fontSize: 13,
    color: '#8899AA',
  },
  switchLink: {
    color: '#00D4AA',
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#1C2B45',
  },
  forgotRow: { alignItems: 'center', marginTop: 12 },
  forgotText: { fontSize: 13, color: '#00D4AA', fontWeight: '600' },

  mfaSubtitle: {
    fontSize: 13,
    color: '#8899AA',
    lineHeight: 20,
    marginBottom: 24,
  },
  codeInput: {
    backgroundColor: '#1C2B45',
    borderRadius: 12,
    paddingVertical: 16,
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 8, // Spaces out the digits visually
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 16,
  },
});
