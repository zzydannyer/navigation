const { getDefaultConfig } = require('expo/metro-config');
// Expo resolves pnpm workspace packages and configures development builds.
module.exports = getDefaultConfig(__dirname);
