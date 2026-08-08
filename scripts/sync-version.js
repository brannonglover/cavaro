#!/usr/bin/env node
/**
 * Syncs version metadata across package.json, the server package, and the iOS
 * Xcode project. During EAS iOS builds, we also stamp a fresh
 * CURRENT_PROJECT_VERSION so App Store submissions do not reuse an old build.
 *
 * Run manually with: node scripts/sync-version.js
 * Include a fresh iOS build number with: node scripts/sync-version.js --with-build-number
 * Or automatically via: npm run version:sync / npm version patch|minor|major
 */

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const appConfigPath = path.join(rootDir, "app.config.js");
const serverPkgPath = path.join(rootDir, "server", "package.json");
const iosProjectPath = path.join(rootDir, "ios", "Cavaro.xcodeproj", "project.pbxproj");
const includeBuildNumber = process.argv.includes("--with-build-number");

const { expo } = require(appConfigPath);
const version = expo.version;
const buildNumber = expo.ios?.buildNumber;

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function replaceAllOrThrow(contents, pattern, replaceWith, label) {
  if (!pattern.test(contents)) {
    throw new Error(`Unable to find ${label} in ${path.basename(iosProjectPath)}`);
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

let iosProject = fs.readFileSync(iosProjectPath, "utf8");
iosProject = replaceAllOrThrow(
  iosProject,
  /MARKETING_VERSION = [^;]+;/g,
  `MARKETING_VERSION = ${version};`,
  "MARKETING_VERSION"
);

if (includeBuildNumber) {
  iosProject = replaceAllOrThrow(
    iosProject,
    /CURRENT_PROJECT_VERSION = [^;]+;/g,
    `CURRENT_PROJECT_VERSION = ${buildNumber};`,
    "CURRENT_PROJECT_VERSION"
  );
}

fs.writeFileSync(iosProjectPath, iosProject);

console.log(`Synced version ${version} to server/package.json and ios/Cavaro.xcodeproj/project.pbxproj`);
if (includeBuildNumber) {
  console.log(`Stamped iOS CURRENT_PROJECT_VERSION ${buildNumber}`);
}
