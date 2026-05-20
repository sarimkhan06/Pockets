import { useState, useEffect } from 'react';
import { StyleSheet, Platform, StatusBar, ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from './lib/supabase';
import LoginScreen from './screens/LoginScreen';
import OnboardingFlow from './screens/OnboardingFlow';
import MainNavigator from './navigation/MainNavigator';

export default function App() {
  const [screen, setScreen] = useState('loading'); // 'loading' | 'login' | 'onboarding' | 'main'
  const [profile, setProfile] = useState(null);
  const [currentMethod, setCurrentMethod] = useState(null);

  useEffect(() => {
    // Check if the user already has an active session when the app opens
    // If yes, skip login and go straight to main
    supabase.auth.getSession().then(({ data: { session } }) => {
      setScreen(session ? 'main' : 'login');
    });

    // Listen for auth changes — fires when user logs in, logs out, or session expires
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setScreen('login'); // session ended — send back to login
    });

    // Clean up the listener when the component unmounts
    return () => subscription.unsubscribe();
  }, []);

  const handleOnboardingComplete = ({ method, profile: profileData }) => {
    setCurrentMethod(method);
    setProfile(profileData);
    setScreen('main');
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
            onLogin={() => setScreen('main')}
            onSignUp={() => setScreen('onboarding')}
          />
        )}

        {screen === 'onboarding' && (
          <OnboardingFlow onComplete={handleOnboardingComplete} />
        )}

        {screen === 'main' && (
          <NavigationContainer>
            <MainNavigator
              onLogout={() => setScreen('login')}
              onRetakeQuiz={() => setScreen('onboarding')}
              profile={profile}
              currentMethod={currentMethod}
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
