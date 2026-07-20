// This file holds shared configuration values used throughout the app.
//
// Two ways this resolves, depending on how the app was started:
//
// 1. Standalone build (e.g. a personal EAS build installed as a real app) — reads a
//    fixed backend URL from EXPO_PUBLIC_API_URL, baked in at build time via eas.json.
//    Anyone building their own standalone copy sets this to wherever THEY host their
//    backend (see eas.json) — it has nothing to do with anyone else's deployment.
//
// 2. Local development (`npx expo start`, the setup described in the README) — the
//    backend runs on your own machine, so the app needs your machine's local IP. That
//    changes every time you switch WiFi, so instead of editing this file by hand, we
//    read it automatically from Expo's dev server address.
import { NativeModules } from 'react-native';
import Constants from 'expo-constants';

function getDevServerIp() {
  // Constants.expoConfig.hostUri is Expo's officially supported way to get the dev
  // server's address (looks like "192.168.2.140:8081").
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) return ip;
  }

  // Older/backup method — looks like "http://10.0.0.248:8081/index.bundle?..." — not
  // populated on every Expo Go version, so it's a fallback rather than the primary check.
  const scriptURL = NativeModules.SourceCode?.scriptURL;
  const match = scriptURL?.match(/\/\/([\d.]+):/);
  if (match) return match[1];

  return null;
}

const ip = getDevServerIp() || '192.168.2.140'; // Local-dev fallback if auto-detection fails
export const API_URL = process.env.EXPO_PUBLIC_API_URL || `http://${ip}:3000`;
console.log('API_URL:', API_URL); // Handy to check if requests are ever failing to reach the backend
