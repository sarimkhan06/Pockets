import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen({ onLogin, onSignUp }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (isSignUp && password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please make sure both passwords are the same.');
      return;
    }

    setLoading(true);

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (error) {
        Alert.alert('Sign up failed', error.message);
      } else if (!data.user) {
        Alert.alert('Already registered', 'This email already has an account. Try logging in instead.');
      } else {
        onSignUp(data.user);
      }
    } else {
      // Log into an existing account
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        Alert.alert('Login failed', error.message);
      } else {
        // Existing user — go straight to the main app
        onLogin();
      }
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>

        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>P</Text>
          </View>
          <Text style={styles.appName}>Pockets</Text>
          <Text style={styles.tagline}>Your money, your way.</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isSignUp ? 'Create account' : 'Welcome back'}</Text>

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
              autoCapitalize="none"
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
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {isSignUp && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={[
                  styles.input,
                  confirmPassword.length > 0 && confirmPassword !== password && styles.inputError,
                ]}
                placeholder="••••••••"
                placeholderTextColor="#4A5E78"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
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

          <TouchableOpacity onPress={() => { setIsSignUp(prev => !prev); setConfirmPassword(''); setFullName(''); }} style={styles.switchRow}>
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
    justifyContent: 'center',
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
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0B1120',
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
});
