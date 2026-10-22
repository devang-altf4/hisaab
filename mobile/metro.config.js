// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-notifications' barrel import eagerly loads its push "topic subscription" module, which on
// Android does requireNativeModule('ExpoTopicSubscriptionModule'). Play Store Expo Go doesn't ship
// that native module (remote push is disabled in Expo Go on Android), so merely importing
// expo-notifications crashes the app. We never use topic subscriptions, so resolve that file to the
// package's own no-op implementation. Local notifications are unaffected.
const topicSubscriptionStub = path.resolve(
  __dirname,
  'node_modules/expo-notifications/build/TopicSubscriptionModule.js',
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === './TopicSubscriptionModule' &&
    context.originModulePath.includes(`expo-notifications${path.sep}build`)
  ) {
    return { type: 'sourceFile', filePath: topicSubscriptionStub };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
