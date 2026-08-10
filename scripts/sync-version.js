#!/usr/bin/env node
/**
 * Syncs version metadata across package.json, the server package, iOS Xcode,
 * and Android Gradle. During EAS builds (--with-build-number), also stamps a
 * fresh iOS CURRENT_PROJECT_VERSION and Android versionCode.
 *
 * Run manually with: node scripts/sync-version.js
 * Include fresh build numbers with: node scripts/sync-version.js --with-build-number
 * Or automatically via: npm run version:sync / npm version patch|minor|major
 */

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const appConfigPath = path.join(rootDir, "app.config.js");
const serverPkgPath = path.join(rootDir, "server", "package.json");
const iosProjectPath = path.join(rootDir, "ios", "Cavaro.xcodeproj", "project.pbxproj");
const androidAppGradlePath = path.join(rootDir, "android", "app", "build.gradle");
const includeBuildNumber = process.argv.includes("--with-build-number");

const { expo } = require(appConfigPath);
const version = expo.version;
const buildNumber = expo.ios?.buildNumber;
const versionCode = expo.android?.versionCode;

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function replaceAllOrThrow(contents, pattern, replaceWith, label, fileLabel) {
  if (!pattern.test(contents)) {
    throw new Error(`Unable to find ${label} in ${fileLabel}`);
  }
  return contents.replace(pattern, replaceWith);
}

if (fs.existsSync(serverPkgPath)) {
  const serverPkg = JSON.parse(fs.readFileSync(serverPkgPath, "utf8"));
  serverPkg.version = version;
  writeJson(serverPkgPath, serverPkg);
} else {
  console.log("server/package.json not found (excluded via .easignore on build worker), skipping");
}

if (fs.existsSync(iosProjectPath)) {
  let iosProject = fs.readFileSync(iosProjectPath, "utf8");
  iosProject = replaceAllOrThrow(
    iosProject,
    /MARKETING_VERSION = [^;]+;/g,
    `MARKETING_VERSION = ${version};`,
    "MARKETING_VERSION",
    path.basename(iosProjectPath)
  );

  if (includeBuildNumber) {
    iosProject = replaceAllOrThrow(
      iosProject,
      /CURRENT_PROJECT_VERSION = [^;]+;/g,
      `CURRENT_PROJECT_VERSION = ${buildNumber};`,
      "CURRENT_PROJECT_VERSION",
      path.basename(iosProjectPath)
    );
  }

  fs.writeFileSync(iosProjectPath, iosProject);
} else {
  console.log("ios Xcode project not found, skipping");
}

if (fs.existsSync(androidAppGradlePath)) {
  let androidGradle = fs.readFileSync(androidAppGradlePath, "utf8");
  androidGradle = replaceAllOrThrow(
    androidGradle,
    /versionName "[^"]*"/,
    `versionName "${version}"`,
    "versionName",
    path.basename(androidAppGradlePath)
  );

  if (includeBuildNumber && versionCode != null) {
    androidGradle = replaceAllOrThrow(
      androidGradle,
      /versionCode \d+/,
      `versionCode ${versionCode}`,
      "versionCode",
      path.basename(androidAppGradlePath)
    );
  }

  fs.writeFileSync(androidAppGradlePath, androidGradle);
} else {
  console.log("android/app/build.gradle not found, skipping");
}

console.log(`Synced version ${version} to server, iOS, and Android`);
if (includeBuildNumber) {
  console.log(`Stamped iOS CURRENT_PROJECT_VERSION ${buildNumber}`);
  if (versionCode != null) {
    console.log(`Stamped Android versionCode ${versionCode}`);
  }
}
