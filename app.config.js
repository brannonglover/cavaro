const packageJson = require("./package.json");

const version = packageJson.version;

function getBuildNumber() {
  if (process.env.APP_BUILD_NUMBER) return process.env.APP_BUILD_NUMBER;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// Android versionCode must be a positive 32-bit integer.
// Minutes since 2024-01-01 gives ~4,000 years of headroom.
function getVersionCode() {
  if (process.env.APP_BUILD_NUMBER) return parseInt(process.env.APP_BUILD_NUMBER, 10);
  const epoch = new Date("2024-01-01T00:00:00Z").getTime();
  return Math.floor((Date.now() - epoch) / 60_000);
}

const buildNumber = getBuildNumber();
const versionCode = getVersionCode();

module.exports = {
  expo: {
    scheme: "cavaro",
    name: "Cavaro",
    slug: "cavaro",
    version,
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/logo-wd.png",
      resizeMode: "contain",
      backgroundColor: "#1a1512",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.brannonglover.cavaro",
      buildNumber,
      associatedDomains: ["webcredentials:cavaroapp.com"],
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        LSApplicationQueriesSchemes: ["https", "http"],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      permissions: ["android.permission.RECORD_AUDIO"],
      package: "com.brannonglover.cavaro",
      versionCode,
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          image: "./assets/logo-wd.png",
          backgroundColor: "#1a1512",
          resizeMode: "contain",
          imageWidth: 200,
          ios: { fadeDurationMs: 500 },
          android: { fadeDurationMs: 500 },
        },
      ],
      "expo-sqlite",
      [
        "expo-image-picker",
        {
          photosPermission: "Allow Cavaro to access your photos to add cigar images.",
          cameraPermission: "Allow Cavaro to use your camera to take photos of cigars.",
        },
      ],
      "react-native-iap",
    ],
    extra: {
      eas: {
        projectId: "b9407779-7a2d-46f7-8626-3a5091f02052",
      },
      legal: {
        termsOfUseUrl: "https://cavaroapp.com/terms",
        privacyPolicyUrl: "https://cavaroapp.com/privacy",
      },
      iap: {
        premiumProductId: "com.gloverlabs.cavaro.monthly_premium",
      },
    },
    owner: "brannonglover",
  },
};
