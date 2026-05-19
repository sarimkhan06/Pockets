import { useState } from 'react';
import { StyleSheet, Platform, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import LoginScreen from './screens/LoginScreen';
import OnboardingFlow from './screens/OnboardingFlow';
import MainNavigator from './navigation/MainNavigator';

export default function App() {
  const [screen, setScreen] = useState('login'); // 'login' | 'onboarding' | 'main'
  const [profile, setProfile] = useState(null);
  const [currentMethod, setCurrentMethod] = useState(null);

  const handleOnboardingComplete = ({ method, profile: profileData }) => {
    setCurrentMethod(method);
    setProfile(profileData);
    setScreen('main');
  };

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
