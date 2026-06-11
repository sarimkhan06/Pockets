// App.js — the root component of the entire app.
//
// This file is responsible for ONE thing: deciding which top-level screen to show.
// It doesn't render any UI itself; it just picks between three states:
//   'loading'    → show a spinner while we check if the user is logged in
//   'login'      → show the LoginScreen
//   'onboarding' → show the OnboardingFlow (first-time setup or changing template)
//   'main'       → show the MainNavigator (the full app with bottom tabs)
//
// Data flow:
//   App.js manages global state (auth status, inbox count, current method).
//   It passes callbacks down into child components so they can trigger transitions.
//   For example, when LoginScreen succeeds, it calls onLogin() which runs code here.

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
  // 'screen' drives which top-level view is shown — it's a simple state machine
  const [screen, setScreen] = useState('loading'); // 'loading' | 'login' | 'onboarding' | 'main'

  // These pieces of state are kept here (at the top) because multiple screens need them
  const [userName, setUserName] = useState('');           // displayed in Dashboard + Settings
  const [currentMethod, setCurrentMethod] = useState(null); // the active budgeting template object
  const [signUpUser, setSignUpUser] = useState(null);     // the user object from a fresh sign-up
  const [isRetake, setIsRetake] = useState(false);        // true when user is changing their template
  const [inboxCount, setInboxCount] = useState(0);        // the red badge number on the Inbox tab

  // useCallback memoizes a function so it doesn't get recreated on every render.
  // This matters here because these functions are passed as props — without useCallback,
  // every re-render would create a new function reference, causing unnecessary child re-renders.

  // Fetches the current number of unassigned inbox transactions and updates the badge.
  const refreshInboxCount = useCallback(async (userId) => {
    try {
      const res = await fetch(`${API_URL}/transactions/inbox?userId=${userId}`);
      // .json() parses the raw HTTP response body from a JSON string into a JS array
      const data = await res.json();
      setInboxCount(Array.isArray(data) ? data.length : 0);
    } catch (e) {}
  }, []);

  // Calls the backend to pull new transactions from Plaid, then refreshes the inbox count
  // and shows a native Alert if there are new items waiting for the user's attention.
  const syncAndNotify = useCallback(async (userId) => {
    try {
      await fetch(`${API_URL}/plaid/sync-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
    } catch (e) {} // Non-fatal: if sync fails, the user can retry from Transactions tab
    try {
      const res = await fetch(`${API_URL}/transactions/inbox?userId=${userId}`);
      const data = await res.json();
      const count = Array.isArray(data) ? data.length : 0;
      setInboxCount(count);
      // Only alert if there are actually new transactions to review
      if (count > 0) {
        Alert.alert(
          'Transactions to review',
          `You have ${count} unassigned transaction${count !== 1 ? 's' : ''} in your inbox.`,
          [{ text: 'OK' }],
        );
      }
    } catch (e) {}
  }, []);

  // useEffect with an empty dependency array [] runs once when the app first loads.
  // Its job: check if the user already has an active session (they were logged in before).
  useEffect(() => {
    // getSession() reads the locally-stored auth token (from the last login).
    // If it finds a valid token, session.user contains the logged-in user's data.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        // No token found — user needs to log in
        setScreen('login');
        return;
      }

      // We have a session — grab the user's name from their profile metadata
      const name = session.user.user_metadata?.full_name || '';
      setUserName(name);

      try {
        // Promise.all fires both requests at the same time (in parallel) instead of
        // waiting for one to finish before starting the other. Faster.
        const [settingsRes, plaidRes] = await Promise.all([
          fetch(`${API_URL}/user-settings?userId=${session.user.id}`),
          fetch(`${API_URL}/plaid/status?userId=${session.user.id}`),
        ]);
        const settings = await settingsRes.json();
        const plaid = await plaidRes.json();

        // Only go to main if the user has BOTH a saved budgeting method AND a bank connected.
        // If either is missing, they need to finish onboarding.
        if (settings?.method_id && plaid?.connected) {
          setCurrentMethod(TEMPLATES[settings.method_id]);
          setScreen('main');
          syncAndNotify(session.user.id); // Background sync on every app open
        } else {
          setScreen('onboarding'); // Resume incomplete setup
        }
      } catch (e) {
        // If the backend is unreachable, go to main anyway so the app doesn't get stuck
        setScreen('main');
        syncAndNotify(session.user.id);
      }
    });

    // onAuthStateChange listens for auth events while the app is running.
    // We only care about SIGNED_OUT — when the user explicitly logs out.
    // We must NOT send to login on every null-session event because SIGNED_UP
    // also fires with a null session when email confirmation is required.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === 'SIGNED_OUT') setScreen('login');
    });

    // Cleanup: remove the listener when App unmounts (app closes).
    // Without this, the listener would keep running and potentially cause memory leaks.
    return () => subscription.unsubscribe();
  }, []); // Empty array = run once on mount only

  // Called by OnboardingFlow when the user finishes setup (or changes their template).
  // At this point we know they have pockets and a bank, so we go straight to main.
  const handleOnboardingComplete = ({ method }) => {
    setCurrentMethod(method);
    setIsRetake(false);
    setUserName(signUpUser?.user_metadata?.full_name || '');
    setScreen('main');
    // Refresh the inbox badge now that pockets + transactions exist
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) refreshInboxCount(session.user.id);
    });
  };

  // During the initial session check, show a full-screen spinner
  if (screen === 'loading') {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    );
  }

  return (
    // SafeAreaProvider + SafeAreaView prevent content from going behind the camera notch
    // or home-indicator bar on iPhones.
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        {/* StatusBar controls the top bar (time + battery) appearance */}
        <StatusBar barStyle="light-content" backgroundColor="#0B1120" />

        {/* Only one of these three blocks renders at a time, based on the 'screen' state */}

        {screen === 'login' && (
          <LoginScreen
            // onLogin is called after a successful login — we check if the user
            // already has a setup and route accordingly
            onLogin={async () => {
              const { data: { session } } = await supabase.auth.getSession();
              setUserName(session?.user?.user_metadata?.full_name || '');
              try {
                const [settingsRes, plaidRes] = await Promise.all([
                  fetch(`${API_URL}/user-settings?userId=${session.user.id}`),
                  fetch(`${API_URL}/plaid/status?userId=${session.user.id}`),
                ]);
                const settings = await settingsRes.json();
                const plaid = await plaidRes.json();
                if (settings?.method_id && plaid?.connected) {
                  setCurrentMethod(TEMPLATES[settings.method_id]);
                  setScreen('main');
                  syncAndNotify(session.user.id);
                } else {
                  setScreen('onboarding');
                }
              } catch (e) {
                setScreen('main');
                syncAndNotify(session.user.id);
              }
            }}
            // onSignUp is called after a successful sign-up — the user object is saved
            // so OnboardingFlow can use it to create pockets for the right userId
            onSignUp={(user) => { setSignUpUser(user); setScreen('onboarding'); }}
          />
        )}

        {screen === 'onboarding' && (
          <OnboardingFlow
            onComplete={handleOnboardingComplete}
            signUpUser={signUpUser}       // The new user object (null if logging in for the first time)
            isRetake={isRetake}           // true = user is changing their template, not a new setup
            currentMethodId={isRetake ? currentMethod?.id : undefined} // So the backend can save a backup
            onCancel={isRetake ? () => { setIsRetake(false); setScreen('main'); } : null} // Only show Cancel for retakes
          />
        )}

        {screen === 'main' && (
          // NavigationContainer is the React Navigation wrapper — required for any navigation to work.
          // It's placed here (not at the top of the file) so it's only mounted when the user is logged in.
          <NavigationContainer>
            <MainNavigator
              onLogout={() => setScreen('login')}
              onRetakeQuiz={() => { setIsRetake(true); setScreen('onboarding'); }}
              userName={userName}
              currentMethod={currentMethod}
              inboxCount={inboxCount}
              onRefreshInboxCount={refreshInboxCount}
              // Called by SettingsScreen after a restore — updates the method display immediately
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
    // On Android, the safe area doesn't account for the status bar automatically,
    // so we add manual top padding using the StatusBar.currentHeight constant.
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
});
