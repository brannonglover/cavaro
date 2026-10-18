/**
 * Test-only failure injection.
 *
 * Used by the simulator test pass to exercise error paths that cannot be
 * triggered from outside the app (a local SQLite write failing, for example).
 *
 * Doubly gated: it is inert unless BOTH `__DEV__` is true AND the env var is
 * explicitly set, so it can never fire in a release build even if the env var
 * somehow leaked into one. Nothing in the app sets these — they are passed in
 * .env.development.local by hand when running a failure scenario.
 */

function enabled(flag) {
  return __DEV__ && process.env[flag] === '1';
}

/**
 * Throws a simulated local-save failure when EXPO_PUBLIC_TEST_FAIL_SAVE=1.
 * The message is shaped so categorizeError() buckets it as `database`.
 */
export function maybeFailSave(label) {
  if (!enabled('EXPO_PUBLIC_TEST_FAIL_SAVE')) return;
  throw new Error(`SQLITE_FULL: simulated ${label} save failure (test failpoint)`);
}
