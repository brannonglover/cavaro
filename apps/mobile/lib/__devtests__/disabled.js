/**
 * Inert stand-in for the migration E2E harness.
 *
 * metro.config.js aliases lib/__devtests__/migrationE2E to this module whenever
 * EXPO_PUBLIC_RUN_MIGRATION_E2E is not '1', so the real harness — and the
 * DELETE statements in its resetLocal() — are never bundled into a build that
 * is not explicitly running the verification. The dynamic import in App.js
 * still resolves, it just lands here.
 */

export default async function runMigrationE2EDisabled() {
  throw new Error('Migration E2E harness is not included in this build.');
}
