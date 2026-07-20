// This file holds shared configuration values used throughout the app.
//
// In development, the app runs on your phone but the backend runs on your laptop —
// so the app needs your laptop's IP address on the local network. That IP changes
// every time you switch WiFi, which used to mean editing this file by hand.
//
// Instead, we read it automatically. Constants.expoConfig.hostUri is Expo's officially
// supported way to get the dev server's address (looks like "192.168.2.140:8081").
// We also try the older NativeModules.SourceCode.scriptURL as a backup, since it's
// not populated on every Expo Go version.
import { NativeModules } from 'react-native';
import Constants from 'expo-constants';

function getDevServerIp() {
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) return ip;
  }

  // Older/backup method — looks like "http://10.0.0.248:8081/index.bundle?..."
  const scriptURL = NativeModules.SourceCode?.scriptURL;
  const match = scriptURL?.match(/\/\/([\d.]+):/);
  if (match) return match[1];

  return null;
}

// Falls back to a hardcoded IP if auto-detection ever fails (e.g. a production build).
const ip = getDevServerIp() || '192.168.2.140';
export const API_URL = `http://${ip}:3000`;
console.log('API_URL:', API_URL); // Handy to check if requests are ever failing to reach the backend
