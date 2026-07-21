const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @supabase/supabase-js ships a "exports" field pointing at a Node.js-targeted build that
// bundles Node's undici (for fetch), which includes an OpenTelemetry dynamic import using
// syntax Hermes can't compile ("Invalid expression encountered" on OTEL_PKG). Disabling
// package-exports resolution makes Metro fall back to Supabase's main/module fields, which
// point at its React Native-safe build instead.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
