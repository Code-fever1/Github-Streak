/** @type {import('expo/config').ExpoConfig} */
export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    streakServerUrl: process.env.EXPO_PUBLIC_STREAK_SERVER_URL || '',
  },
});
