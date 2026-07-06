// This file holds shared configuration values used throughout the app.
//
// In development, the app runs on your phone but the backend runs on your laptop —
// so the app needs your laptop's IP address on the local network. That IP changes
// every time you switch WiFi, which used to mean editing this file by hand.
//
// Instead, we read it automatically from Expo's bundler URL. When Expo serves the
// app to your phone, it embeds the laptop's address (e.g. "http://10.0.0.248:8081/...")
// in NativeModules.SourceCode.scriptURL. We pull the IP out of that and point the
// backend at the same machine on port 3000.
import { NativeModules } from 'react-native';

// scriptURL looks like: http://10.0.0.248:8081/index.bundle?platform=ios&dev=true
// The regex grabs the IP between "//" and ":".
function getDevServerIp() {
  const scriptURL = NativeModules.SourceCode?.scriptURL;
  if (!scriptURL) return null;
  const match = scriptURL.match(/\/\/([\d.]+):/);
  return match ? match[1] : null;
}

// Falls back to a hardcoded IP if auto-detection ever fails (e.g. a production build).
const ip = getDevServerIp() || '10.0.0.248';
export const API_URL = `http://${ip}:3000`;
