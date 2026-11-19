// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * Keep the destructive migration test harness out of any bundle that is not
 * explicitly building it.
 *
 * lib/__devtests__/migrationE2E.js wipes every local cigar, humidor, cellared
 * item and journal entry via resetLocal(). App.js reaches it through a dynamic
 * import guarded by EXPO_PUBLIC_RUN_MIGRATION_E2E, and the module re-checks the
 * same flag itself — but Metro resolves statically-analysable dynamic imports
 * regardless of whether the branch can run, so without this the module and its
 * DELETE statements ship inside production bundles as dead code.
 *
 * Aliasing (rather than blocking) keeps the import resolvable: production
 * builds land on an inert stub, so absence of the destructive code is a
 * build-time guarantee instead of a reasoning exercise. Set the flag to build
 * the real harness back in for a verification run.
 */
const HARNESS_ENABLED = process.env.EXPO_PUBLIC_RUN_MIGRATION_E2E === '1';
const STUB = path.resolve(__dirname, 'lib/__devtests__/disabled.js');

if (!HARNESS_ENABLED) {
  const defaultResolve = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (/__devtests__[\\/]migrationE2E$/.test(moduleName)) {
      return { type: 'sourceFile', filePath: STUB };
    }
    return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
  };
}

module.exports = config;
