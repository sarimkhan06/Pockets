import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Platform, StatusBar, ActivityIndicator, View, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from './lib/supabase';
import { API_URL } from './lib/config';
import { TEMPLATES } from './data/onboardingData';
import LoginScreen from './screens/LoginScreen';
import OnboardingFlow from './screens/OnboardingFlow';
import MainNavigator from './navigation/MainNavigator';

export default function App() {
  const [screen, setScreen] = useState('loading'); // 'loading' | 'login' | 'onboarding' | 'main'
  const [userName, setUserName] = useState('');
  const [currentMethod, setCurrentMethod] = useState(null);
  const [signUpUser, setSignUpUser] = useState(null);
  const [isRetake, setIsRetake] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);

  const refreshInboxCount = useCallback(async (userId) => {
    try {
      const res = await fetch(`${API_URL}/transactions/inbox?userId=${userId}`);
      const data = await res.json();
      setInboxCount(Array.isArray(data) ? data.length : 0);
    } catch (e) {}
  }, []);

  const syncAndNotify = useCallback(async (userId) => {
    try {
      await fetch(`${API_URL}/plaid/sync-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
    } catch (e) {}
    try {
      const res = await fetch(`${API_URL}/transactions/inbox?userId=${userId}`);
      const data = await res.json();
      const count = Array.isArray(data) ? data.length : 0;
      setInboxCount(count);
      if (count > 0) {
        Alert.alert(
          'Transactions to review',
          `You have ${count} unassigned transaction${count !== 1 ? 's' : ''} in your inbox.`,
          [{ text: 'OK' }],
        );
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    // Check if the user already has an active session when the app opens
    // If yes, fetch their saved budgeting method and go straight to main
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setScreen('login'); return; }

      const name = session.user.user_metadata?.full_name || '';
      setUserName(name);

      try {
        const res = await fetch(`${API_URL}/user-settings?userId=${session.user.id}`);
        const settings = await res.json();
        if (settings?.method_id) setCurrentMethod(TEMPLATES[settings.method_id]);
      } catch (e) {
        console.error('Failed to fetch user settings:', e);
      }
      setScreen('main');
      syncAndNotify(session.user.id);
    });

    // Listen for auth changes — only send to login on explicit sign-out
    // SIGNED_UP fires with a null session when email confirmation is required, so we
    // must not treat every null-session event as a logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === 'SIGNED_OUT') setScreen('login');
    });

    // Clean up the listener when the component unmounts
    return () => subscription.unsubscribe();
  }, []);

  const handleOnboardingComplete = ({ method }) => {
    setCurrentMethod(method);
    setIsRetake(false);
    setUserName(signUpUser?.user_metadata?.full_name || '');
    setScreen('main');
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) refreshInboxCount(session.user.id);
    });
  };

  // Show a spinner while we check for an existing session
  if (screen === 'loading') {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0B1120" />

        {screen === 'login' && (
          <LoginScreen
            onLogin={async () => {
              const { data: { session } } = await supabase.auth.getSession();
              setUserName(session?.user?.user_metadata?.full_name || '');
              setScreen('main');
              if (session?.user?.id) syncAndNotify(session.user.id);
            }}
            onSignUp={(user) => { setSignUpUser(user); setScreen('onboarding'); }}
          />
        )}

        {screen === 'onboarding' && (
          <OnboardingFlow
            onComplete={handleOnboardingComplete}
            signUpUser={signUpUser}
            isRetake={isRetake}
            currentMethodId={isRetake ? currentMethod?.id : undefined}
            onCancel={isRetake ? () => { setIsRetake(false); setScreen('main'); } : null}
          />
        )}

        {screen === 'main' && (
          <NavigationContainer>
            <MainNavigator
              onLogout={() => setScreen('login')}
              onRetakeQuiz={() => { setIsRetake(true); setScreen('onboarding'); }}
              userName={userName}
              currentMethod={currentMethod}
              inboxCount={inboxCount}
              onRefreshInboxCount={refreshInboxCount}
              onRestoreComplete={(methodId) => {
                if (methodId && TEMPLATES[methodId]) setCurrentMethod(TEMPLATES[methodId]);
              }}
            />
          </NavigationContainer>
        )}

      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
});
