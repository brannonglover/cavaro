const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

function applyReplacement({ name, relativePath, before, after, skipIfContains }) {
  const filePath = path.join(repoRoot, relativePath);

  if (!fs.existsSync(filePath)) {
    console.log(`[patches] skipped ${name} (missing ${relativePath})`);
    return;
  }

  const original = fs.readFileSync(filePath, "utf8");

  if (skipIfContains && original.includes(skipIfContains)) {
    console.log(`[patches] already applied ${name}`);
    return;
  }

  if (!original.includes(before)) {
    console.log(`[patches] skipped ${name} (expected snippet not found)`);
    return;
  }

  const updated = original.replace(before, after);

  if (updated === original) {
    console.log(`[patches] already applied ${name}`);
    return;
  }

  fs.writeFileSync(filePath, updated);
  console.log(`[patches] applied ${name}`);
}

applyReplacement({
  name: "expo-dev-menu simulator detection",
  relativePath: "node_modules/expo-dev-menu/ios/DevMenuViewController.swift",
  before: [
    "  private func initialProps() -> [String: Any] {",
    "    let isSimulator = TARGET_IPHONE_SIMULATOR > 0",
  ].join("\n"),
  after: [
    "  private func initialProps() -> [String: Any] {",
    "#if targetEnvironment(simulator)",
    "    let isSimulator = true",
    "#else",
    "    let isSimulator = false",
    "#endif",
  ].join("\n"),
  skipIfContains: "#if targetEnvironment(simulator)",
});

applyReplacement({
  name: "expo-localization Xcode 26 calendar fallback",
  relativePath: "node_modules/expo-localization/ios/LocalizationModule.swift",
  before: [
    "    case .republicOfChina:",
    "      return \"roc\"",
    "    case .iso8601:",
    "      return \"iso8601\"",
    "    }",
  ].join("\n"),
  after: [
    "    case .republicOfChina:",
    "      return \"roc\"",
    "    case .iso8601:",
    "      return \"iso8601\"",
    "    @unknown default:",
    "      return \"iso8601\"",
    "    }",
  ].join("\n"),
  skipIfContains: "@unknown default:",
});

// react-native-nitro-modules (via react-native-iap) targets a ReactModuleInfo
// signature that does not match React Native 0.76's named constructors.
applyReplacement({
  name: "nitro-modules ReactModuleInfo RN 0.76",
  relativePath:
    "node_modules/react-native-nitro-modules/android/src/main/java/com/margelo/nitro/NitroModulesPackage.kt",
  before: [
    "      moduleInfos[NitroModules.NAME] =",
    "        ReactModuleInfo(",
    "          NitroModules.NAME,",
    "          NitroModules.NAME,",
    "          canOverrideExistingModule = false,",
    "          needsEagerInit = false,",
    "          isCxxModule = false,",
    "          isTurboModule = isTurboModule,",
    "        )",
  ].join("\n"),
  after: [
    "      moduleInfos[NitroModules.NAME] =",
    "        ReactModuleInfo(",
    "          NitroModules.NAME,",
    "          NitroModules.NAME,",
    "          false,",
    "          false,",
    "          false,",
    "          false,",
    "          isTurboModule,",
    "        )",
  ].join("\n"),
  skipIfContains: "false,\n          false,\n          false,\n          false,\n          isTurboModule,",
});

applyReplacement({
  name: "react-native-bottom-tabs Platform inlineRequires",
  relativePath: "node_modules/react-native-bottom-tabs/lib/module/TabView.js",
  before: [
    "const isAppleSymbol = icon => icon?.sfSymbol;",
    "const ANDROID_MAX_TABS = 100;",
    "const TabView = ({",
  ].join("\n"),
  after: [
    "const isAppleSymbol = icon => icon?.sfSymbol;",
    "const ANDROID_MAX_TABS = 100;",
    "const IS_ANDROID = Platform.OS === 'android';",
    "const IS_IOS = Platform.OS === 'ios';",
    "const TabView = ({",
  ].join("\n"),
  skipIfContains: "const IS_ANDROID = Platform.OS === 'android';",
});
